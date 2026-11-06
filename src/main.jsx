
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  ShoppingBag,
  Plus,
  Minus,
  MapPin,
  Clock,
  ArrowRight,
  X,
  RefreshCw,
  LogOut,
  Upload,
  ClipboardList,
  Truck,
} from "lucide-react";

import "./styles.css";

// ======================================
// SUPABASE CONNECTION
// ======================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// ======================================
// CONFIGURATION
// ======================================

const QR = "/images/qr.jpeg";

const products = [
  {
    id: "donut",
    name: "Rainbow Sprinkle Donut",
    price: 79,
    category: "Bakery",
    image: "/images/donut.svg",
    desc: "Soft, fluffy and topped with chocolate & sprinkles.",
  },
  {
    id: "hot-small",
    name: "Hot Chocolate · Small",
    price: 59,
    category: "Drinks",
    image: "/images/hotchocolate.svg",
    desc: "A warm, rich chocolate drink.",
  },
  {
    id: "hot-large",
    name: "Hot Chocolate · Large",
    price: 79,
    category: "Drinks",
    image: "/images/hotchocolate.svg",
    desc: "A bigger cup of warm chocolate goodness.",
  },
  {
    id: "fries",
    name: "Classic French Fries",
    price: 40,
    category: "Snacks",
    image: "/images/fries.svg",
    desc: "Golden, crispy and perfectly salted.",
  },
  {
    id: "combo",
    name: "Rural Haat Combo",
    price: 150,
    category: "Combos",
    image: "/images/combo.svg",
    desc: "French fries + one donut + small hot chocolate.",
  },
];

const cash = (amount) => "₹" + Number(amount || 0).toFixed(0);

const makeCode = () => "RH" + Date.now().toString().slice(-8);

const makeToken = () => crypto.randomUUID().replaceAll("-", "");

// ======================================
// CUSTOMER COMPONENT
// ======================================

function Customer() {
  const [cart, setCart] = useState({});
  const [filter, setFilter] = useState("All");

  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);

  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [phone, setPhone] = useState("");

  const [shot, setShot] = useState(null);
  const [preview, setPreview] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [order, setOrder] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("rh-current-order") || "null"
      );
    } catch {
      return null;
    }
  });

  const [liveStatus, setLiveStatus] = useState("");

  // CART ITEMS
  const items = products
    .filter((product) => cart[product.id])
    .map((product) => ({
      ...product,
      qty: cart[product.id],
    }));

  // TOTAL
  const total = useMemo(
    () =>
      items.reduce(
        (sum, product) => sum + product.price * product.qty,
        0
      ),
    [items]
  );

  const count = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0
  );

  const shown =
    filter === "All"
      ? products
      : products.filter((product) => product.category === filter);

  // ADD ITEM / COMBO QUANTITY
  const add = (id) => {
    setCart((current) => ({
      ...current,
      [id]: (current[id] || 0) + 1,
    }));
  };

  // REMOVE ITEM
  const remove = (id) => {
    setCart((current) => {
      const updated = { ...current };

      if ((updated[id] || 0) <= 1) {
        delete updated[id];
      } else {
        updated[id]--;
      }

      return updated;
    });
  };

  // ======================================
  // CUSTOMER ORDER TRACKING
  // ======================================

  useEffect(() => {
    if (!order || !supabase) return;

    let active = true;

    const checkStatus = async () => {
      const { data, error } = await supabase.rpc(
        "get_order_status",
        {
          p_order_code: order.order_code,
          p_tracking_token: order.tracking_token,
        }
      );

      if (active && !error && data?.length) {
        setLiveStatus(data[0].order_status);
      }
    };

    checkStatus();

    const timer = setInterval(checkStatus, 7000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [order]);

  // ======================================
  // SUBMIT ORDER
  // ======================================

  async function submitOrder(event) {
    event?.preventDefault();

    if (!name.trim()) {
      setMsg("Please enter your name.");
      return;
    }

    if (!branch.trim()) {
      setMsg("Please enter your branch or department.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!shot) {
      setMsg("Please upload your payment screenshot.");
      return;
    }

    if (!items.length) {
      setMsg("Your cart is empty.");
      return;
    }

    if (!supabase) {
      setMsg("Supabase is not configured. Please contact the organiser.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(shot.type)) {
      setMsg("Please upload a JPG, PNG or WEBP image.");
      return;
    }

    if (shot.size > 5 * 1024 * 1024) {
      setMsg("Image size must be less than 5 MB.");
      return;
    }

    setBusy(true);
    setMsg("");

    const code = makeCode();
    const token = makeToken();

    try {
      const safeFileName = shot.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const path = `${code}/${Date.now()}-${safeFileName}`;

      // UPLOAD PAYMENT SCREENSHOT
      const { error: uploadError } = await supabase.storage
        .from("payment-screenshots")
        .upload(path, shot, {
          contentType: shot.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // ORDER DATA
      const payload = {
        order_code: code,
        tracking_token: token,
        customer_name: name.trim(),
        branch: branch.trim(),
        phone: cleanPhone,
        items: items.map(({ id, name, price, qty }) => ({
          id,
          name,
          price,
          qty,
        })),
        total,
        payment_screenshot_path: path,
        order_status: "pending",
      };

      // SAVE TO SUPABASE
      const { error } = await supabase
        .from("orders")
        .insert(payload);

      if (error) throw error;

      // SAVE TRACKING DETAILS
      const saved = {
        order_code: code,
        tracking_token: token,
        customer_name: name.trim(),
        branch: branch.trim(),
        phone: cleanPhone,
        total,
      };

      localStorage.setItem(
        "rh-current-order",
        JSON.stringify(saved)
      );

      setOrder(saved);
      setLiveStatus("pending");

      // RESET FORM AND CART
      setCart({});
      setCheckout(false);
      setCartOpen(false);

      setShot(null);
      setPreview("");
      setName("");
      setBranch("");
      setPhone("");
      setMsg("");

      alert(
        `Order submitted successfully!\nOrder ID: ${code}`
      );
    } catch (error) {
      setMsg(
        error.message || "Could not submit order. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const statusClass = liveStatus || "pending";

  const statusMessage =
    liveStatus === "confirmed"
      ? "Your order is confirmed!"
      : liveStatus === "delivered"
      ? "Your order has been delivered!"
      : "Your order is pending confirmation.";

  // ======================================
  // CUSTOMER PAGE
  // ======================================

  return (
    <div className="app">

      <div className="topline">
        A LITTLE TREAT, A LOT OF HAPPINESS
        <span>✦</span>
        RURAL HAAT · CUTM
      </div>

      <header className="header">

        <a className="brand" href="/">
          <div className="brand-mark">RH</div>
          <div>
            <b>RURAL HAAT</b>
            <small>BAKERY DELIGHTS</small>
          </div>
        </a>

        <nav>
          <a href="#menu">Menu</a>
          <a href="#how">How to order</a>
          <a href="#visit">Visit us</a>
        </nav>

        <button
          className="cart-button"
          onClick={() => setCartOpen(true)}
        >
          <ShoppingBag size={18} />
          Cart
          <b>{count}</b>
        </button>

      </header>

      <main>

        {/* HERO */}

        <section className="hero">

          <div className="hero-copy">
            <div className="eyebrow">✦ FRESHLY SERVED AT CUTM</div>

            <h1>
              Good food.
              <br />
              <em>Great mood.</em>
            </h1>

            <p>
              Your campus cravings, made happier.
              Pick your favourites, pay and upload your screenshot.
            </p>

            <a className="primary-btn" href="#menu">
              Explore menu <ArrowRight size={17} />
            </a>

            <div className="hero-tags">
              ✦ Made with love　 ✦ Campus favourites　 ✦ Easy UPI checkout
            </div>
          </div>

          <div className="hero-art">
            <div className="hero-glow"></div>
            <img src="/images/hero-food.svg" alt="Bakery treats" />

            <div className="floating-sticker">
              MADE FOR
              <br />
              <b>HAPPY</b>
              <br />
              BREAKS
            </div>
          </div>

        </section>

        {/* QUICK INFO */}

        <section className="quick-info" id="visit">

          <div>
            <MapPin />
            <span>
              <small>FIND US AT</small>
              <b>Lawn, CUTM, Paralakhemundi</b>
            </span>
          </div>

          <div>
            <Clock />
            <span>
              <small>OPEN FROM</small>
              <b>3:30 PM onwards</b>
            </span>
          </div>

          <div>
            <ClipboardList />
            <span>
              <small>ORDER TRACKING</small>
              <b>Live order status</b>
            </span>
          </div>

        </section>

        {/* MENU */}

        <section className="menu-section" id="menu">

          <div className="section-heading">
            <div>
              <span className="eyebrow">THE GOOD STUFF</span>
              <h2>Made to make you smile<span>.</span></h2>
              <p>Choose a treat. We’ll take care of the cravings.</p>
            </div>

            <div className="menu-stamp">
              RURAL
              <br />
              HAAT
              <br />
              <b>MENU</b>
            </div>
          </div>

          <div className="filters">
            {["All", "Bakery", "Drinks", "Snacks", "Combos"].map(
              (category) => (
                <button
                  key={category}
                  className={filter === category ? "active" : ""}
                  onClick={() => setFilter(category)}
                >
                  {category}
                </button>
              )
            )}
          </div>

          <div className="product-grid">

            {shown.map((product) => (
              <article className="product-card" key={product.id}>

                <div className="product-image">
                  <img src={product.image} alt={product.name} />

                  {product.id === "combo" && (
                    <span className="popular">BEST VALUE</span>
                  )}
                </div>

                <div className="product-info">

                  <div className="product-category">
                    {product.category}
                  </div>

                  <h3>{product.name}</h3>
                  <p>{product.desc}</p>

                  <div className="product-bottom">

                    <b>{cash(product.price)}</b>

                    <button
                      className={cart[product.id] ? "added" : ""}
                      onClick={() => add(product.id)}
                    >
                      <Plus size={16} />
                      {cart[product.id]
                        ? `Added (${cart[product.id]})`
                        : "Add"}
                    </button>

                  </div>

                </div>
              </article>
            ))}

          </div>
        </section>

        {/* COMBO BANNER WITH QUANTITY */}

        <section className="combo-banner">

          <div className="combo-icon">✦</div>

          <div>
            <span>THE CAMPUS FAVOURITE</span>
            <h2>Make it a combo.</h2>
            <p>French Fries + Donut + Small Hot Chocolate</p>
          </div>

          <div className="combo-price">
            <small>ALL THREE FOR</small>
            <b>₹150</b>
          </div>

          <button
            className={cart.combo ? "added" : ""}
            onClick={() => add("combo")}
          >
            <Plus size={16} />
            {cart.combo ? `Added (${cart.combo})` : "Add combo"}
          </button>

        </section>

        {/* HOW TO ORDER */}

        <section className="how-section" id="how">

          <div className="section-heading centered">
            <div>
              <span className="eyebrow">EASY AS 1, 2, 3</span>
              <h2>Your order, your way<span>.</span></h2>
              <p>Add to cart, pay, upload screenshot and track your order.</p>
            </div>
          </div>

          <div className="steps">

            <div>
              <i>01</i>
              <ShoppingBag />
              <b>Pick your treats</b>
              <p>Add favourites to cart.</p>
            </div>

            <div>
              <i>02</i>
              <Plus />
              <b>Check your total</b>
              <p>Cart calculates your amount.</p>
            </div>

            <div>
              <i>03</i>
              <img src={QR} alt="Payment QR" />
              <b>Pay & upload screenshot</b>
              <p>Attach your payment proof.</p>
            </div>

            <div>
              <i>04</i>
              <Truck />
              <b>Track your order</b>
              <p>See pending, confirmed and delivered.</p>
            </div>

          </div>
        </section>

        {/* ORDER TRACKING */}

        {order && (
          <section className="tracking-panel">

            <div className="tracking-top">

              <div>
                <span className="eyebrow">YOUR LATEST ORDER</span>
                <h2>{order.order_code}</h2>
                <p>
                  {order.customer_name} · {order.branch} · {cash(order.total)}
                </p>
              </div>

              <span className={`status-pill ${statusClass}`}>
                {statusClass.toUpperCase()}
              </span>

            </div>

            <div className="status-message">
              {statusMessage}
            </div>

            <small>
              Keep this page open to see status updates.
              Status refreshes automatically.
            </small>

          </section>
        )}

      </main>

      {/* FOOTER */}

      <footer>

        <div className="footer-brand">
          <div className="brand-mark">RH</div>
          <div>
            <b>RURAL HAAT</b>
            <small>BAKERY DELIGHTS</small>
          </div>
        </div>

        <p>Good food. Great mood. See you at the Haat!</p>

        <div className="footer-meta">
          Lawn, CUTM, Paralakhemundi
          <span>•</span>
          From 3:30 PM
        </div>

        <div className="footer-bottom">
          <small>© 2026 Rural Haat · Centurion University campus event</small>

          <small>
            Developed by <b>Dhanumjaya</b> · <a href="/admin">Admin</a>
          </small>
        </div>

      </footer>

      {/* ======================================
          CART DRAWER
      ====================================== */}

      {cartOpen && (
        <div
          className="overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setCartOpen(false);
            }
          }}
        >

          <aside className="drawer">

            <div className="drawer-head">
              <div>
                <span className="eyebrow">YOUR PICKS</span>
                <h2>Your cart</h2>
              </div>

              <button
                className="icon-btn"
                onClick={() => setCartOpen(false)}
              >
                <X />
              </button>
            </div>

            {!items.length ? (
              <div className="empty">
                <ShoppingBag size={42} />
                <h3>Your cart is waiting</h3>
                <p>Add something delicious from the menu.</p>

                <button
                  className="primary-btn"
                  onClick={() => setCartOpen(false)}
                >
                  Explore menu
                </button>
              </div>
            ) : (
              <>
                <div className="cart-list">

                  {items.map((product) => (
                    <div className="cart-row" key={product.id}>

                      <img src={product.image} alt={product.name} />

                      <div className="cart-row-info">
                        <b>{product.name}</b>
                        <small>{cash(product.price)} each</small>

                        <div className="qty">
                          <button onClick={() => remove(product.id)}>
                            <Minus size={13} />
                          </button>

                          <b>{product.qty}</b>

                          <button onClick={() => add(product.id)}>
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>

                      <strong>
                        {cash(product.price * product.qty)}
                      </strong>

                    </div>
                  ))}

                </div>

                <div className="drawer-total">
                  <span>Total amount</span>
                  <b>{cash(total)}</b>
                </div>

                <button
                  className="checkout-btn"
                  onClick={() => {
                    setCartOpen(false);
                    setCheckout(true);
                    setMsg("");
                  }}
                >
                  Continue to payment
                  <ArrowRight size={17} />
                </button>
              </>
            )}

          </aside>
        </div>
      )}

      {/* ======================================
          CHECKOUT
      ====================================== */}

      {checkout && (
        <div className="overlay modal-overlay">

          <form
            className="checkout-modal"
            onSubmit={submitOrder}
          >

            <button
              type="button"
              className="icon-btn close-modal"
              onClick={() => setCheckout(false)}
            >
              <X />
            </button>

            <span className="eyebrow">ORDER CHECKOUT</span>
            <h2>Pay & submit order</h2>

            <div className="checkout-total">
              <span>Cart total to pay</span>
              <b>{cash(total)}</b>
            </div>

            {/* CUSTOMER NAME */}

            <label>
              Your name

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                required
              />
            </label>

            {/* BRANCH */}

            <label>
              Branch / Department

              <input
                type="text"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                placeholder="e.g. CSE, ECE, MBA"
                required
              />
            </label>

            {/* PHONE NUMBER */}

            <label>
              Phone Number

              <input
                type="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                }}
                placeholder="Enter 10-digit mobile number"
                inputMode="numeric"
                maxLength={10}
                required
              />
            </label>

            {/* PAYMENT QR */}

            <div className="payment-card">

              <img
                className="payment-qr"
                src={QR}
                alt="Rural Haat payment QR"
              />

              <b className="pay-amount">{cash(total)}</b>

              <span className="payee">Rural Haat · CUTM</span>

              <small className="upi-id">
                Scan organiser's QR and pay exact amount
              </small>

            </div>

            {/* SCREENSHOT UPLOAD */}

            <label className="upload-label">
              <Upload size={17} />
              Payment screenshot

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  setShot(file || null);

                  setPreview(
                    file ? URL.createObjectURL(file) : ""
                  );
                }}
                required
              />
            </label>

            {preview && (
              <img
                className="screenshot-preview"
                src={preview}
                alt="Payment screenshot preview"
              />
            )}

            {msg && (
              <div className="notice">{msg}</div>
            )}

            <button
              className="checkout-btn"
              type="submit"
              disabled={busy}
            >
              {busy ? "Submitting order..." : "Submit order"}
              <ArrowRight size={17} />
            </button>

            <button
              type="button"
              className="text-btn"
              onClick={() => setCheckout(false)}
            >
              Back
            </button>

          </form>
        </div>
      )}

    </div>
  );
}

// ======================================
// ADMIN COMPONENT
// ======================================

function Admin() {
  const [session, setSession] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("all");
  const [images, setImages] = useState({});

  // ======================================
  // AUTH SESSION
  // ======================================

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ======================================
  // LOGIN
  // ======================================

  async function login(event) {
    event.preventDefault();
    setError("");

    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
  }

  // ======================================
  // LOAD ORDERS
  // ======================================

  async function load() {
    if (!session || !supabase) return;

    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOrders(data || []);

      // Load payment screenshots
      for (const order of data || []) {
        if (
          order.payment_screenshot_path &&
          !images[order.id]
        ) {
          const { data: signed, error: imageError } =
            await supabase.storage
              .from("payment-screenshots")
              .createSignedUrl(
                order.payment_screenshot_path,
                3600
              );

          if (!imageError && signed?.signedUrl) {
            setImages((current) => ({
              ...current,
              [order.id]: signed.signedUrl,
            }));
          }
        }
      }
    } catch (error) {
      setError(error.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  // ======================================
  // AUTO REFRESH
  // ======================================

  useEffect(() => {
    if (!session) return;

    load();

    const timer = setInterval(() => {
      load();
    }, 10000);

    return () => clearInterval(timer);
  }, [session]);

  // ======================================
  // UPDATE ORDER STATUS
  // ======================================

  async function setStatus(id, status) {
    if (!supabase) return;

    setError("");

    const { error } = await supabase
      .from("orders")
      .update({ order_status: status })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    setOrders((current) =>
      current.map((order) =>
        order.id === id
          ? { ...order, order_status: status }
          : order
      )
    );
  }

  // ======================================
  // DELETE ORDER — ADMIN ONLY
  // ======================================

  async function deleteOrder(order) {
    const confirmed = window.confirm(
      `Are you sure you want to delete order ${order.order_code}?`
    );

    if (!confirmed || !supabase) return;

    setError("");

    try {
      // Verify admin session
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!currentSession) {
        throw new Error(
          "Admin session expired. Please login again."
        );
      }

      // Delete order from database
      const { error: deleteError, count } = await supabase
        .from("orders")
        .delete({ count: "exact" })
        .eq("id", order.id);

      if (deleteError) {
        throw deleteError;
      }

      if (count === 0) {
        throw new Error(
          "Order was not deleted. Check your admin UID and Supabase DELETE policy."
        );
      }

      // Remove payment screenshot from storage
      if (order.payment_screenshot_path) {
        const { error: storageError } = await supabase.storage
          .from("payment-screenshots")
          .remove([order.payment_screenshot_path]);

        if (storageError) {
          console.error(
            "Screenshot deletion failed:",
            storageError.message
          );
        }
      }

      // Update dashboard immediately
      setOrders((current) =>
        current.filter((item) => item.id !== order.id)
      );

      setImages((current) => {
        const updated = { ...current };
        delete updated[order.id];
        return updated;
      });

      alert(`${order.order_code} deleted successfully!`);

    } catch (error) {
      console.error("Delete order error:", error);

      setError(
        error.message || "Unable to delete order."
      );
    }
  }

  // ======================================
  // LOGOUT
  // ======================================

  async function logout() {
    if (!supabase) return;

    await supabase.auth.signOut();

    setOrders([]);
    setImages({});
    setError("");
  }

  // ======================================
  // LOGIN SCREEN
  // ======================================

  if (!session) {
    return (
      <div className="admin-page">
        <div className="admin-login">

          <a className="brand" href="/">
            <div className="brand-mark">RH</div>

            <div>
              <b>RURAL HAAT</b>
              <small>ADMIN PANEL</small>
            </div>
          </a>

          <span className="eyebrow">ADMIN ACCESS</span>
          <h1>Login</h1>

          <p>Only the organiser/admin can sign in here.</p>

          <form onSubmit={login}>
            <label>
              Admin email

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
              />
            </label>

            <label>
              Password

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
              />
            </label>

            {error && (
              <div className="notice">{error}</div>
            )}

            <button className="checkout-btn" type="submit">
              Login
              <ArrowRight size={16} />
            </button>
          </form>

          <a className="back-link" href="/">
            ← Customer website
          </a>

        </div>
      </div>
    );
  }

  // ======================================
  // DASHBOARD COUNTS
  // ======================================

  const pending = orders.filter(
    (order) => order.order_status === "pending"
  ).length;

  const confirmed = orders.filter(
    (order) => order.order_status === "confirmed"
  ).length;

  const delivered = orders.filter(
    (order) => order.order_status === "delivered"
  ).length;

  const filtered =
    filter === "all"
      ? orders
      : orders.filter(
          (order) => order.order_status === filter
        );

  // ======================================
  // ADMIN DASHBOARD
  // ======================================

  return (
    <div className="admin-page">

      <header className="admin-header">

        <a className="brand" href="/">
          <div className="brand-mark">RH</div>

          <div>
            <b>RURAL HAAT</b>
            <small>ADMIN DASHBOARD</small>
          </div>
        </a>

        <div className="admin-actions">

          <button className="refresh-btn" onClick={load}>
            <RefreshCw size={15} />
            Refresh
          </button>

          <button className="refresh-btn" onClick={logout}>
            <LogOut size={15} />
            Logout
          </button>

        </div>
      </header>

      <main className="admin-main">

        <div className="admin-title">

          <div>
            <span className="eyebrow">STALL MANAGEMENT</span>
            <h1>Orders dashboard</h1>
            <p>
              Review payment screenshots and update order progress.
            </p>
          </div>

          <div className="admin-stats">

            <div>
              <small>TOTAL ORDERS</small>
              <b>{orders.length}</b>
            </div>

            <div>
              <small>PENDING</small>
              <b>{pending}</b>
            </div>

            <div>
              <small>CONFIRMED</small>
              <b>{confirmed}</b>
            </div>

            <div>
              <small>DELIVERED</small>
              <b>{delivered}</b>
            </div>

          </div>
        </div>

        {error && (
          <div className="notice">{error}</div>
        )}

        {/* FILTERS */}

        <div className="admin-filters">

          {[
            ["all", "All orders"],
            ["pending", "Pending"],
            ["confirmed", "Confirmed"],
            ["delivered", "Delivered"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}

        </div>

        {/* ORDERS */}

        {loading ? (
          <p>Loading orders...</p>
        ) : !filtered.length ? (
          <div className="no-orders">
            <ShoppingBag size={38} />
            <h2>No orders here</h2>
          </div>
        ) : (
          <div className="orders-list">

            {filtered.map((order) => (
              <article className="order-card" key={order.id}>

                <div className="order-card-top">

                  <div>
                    <span className="order-code">
                      {order.order_code}
                    </span>

                    <small>
                      {new Date(
                        order.created_at
                      ).toLocaleString()}
                    </small>
                  </div>

                  {/* STATUS + DELETE */}

                  <div className="order-actions">

                    <select
                      value={order.order_status}
                      onChange={(event) =>
                        setStatus(
                          order.id,
                          event.target.value
                        )
                      }
                      className={`status-${order.order_status}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="delivered">Delivered</option>
                    </select>

                    <button
                      type="button"
                      className="delete-order-btn"
                      onClick={() => deleteOrder(order)}
                    >
                      Delete
                    </button>

                  </div>
                </div>

                {/* CUSTOMER DETAILS */}

                <div className="customer-details">
                  <b>{order.customer_name}</b>

                  <span>{order.branch}</span>

                  <span>
                    Phone: {order.phone || "Not provided"}
                  </span>
                </div>

                {/* ORDER ITEMS */}

                <div className="order-items">

                  {(order.items || []).map((item, index) => (
                    <div key={index}>
                      <span>
                        {item.name} × {item.qty}
                      </span>

                      <b>
                        {cash(item.price * item.qty)}
                      </b>
                    </div>
                  ))}

                </div>

                {/* TOTAL */}

                <div className="order-card-total">
                  <span>Total amount</span>
                  <b>{cash(order.total)}</b>
                </div>

                {/* PAYMENT SCREENSHOT */}

                {images[order.id] && (
                  <a
                    className="proof-link"
                    href={images[order.id]}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View payment screenshot ↗
                  </a>
                )}

              </article>
            ))}

          </div>
        )}

      </main>

      <footer className="admin-footer">
        Developed by <b>Dhanumjaya</b>
        {" · "}
        <a href="/">Customer website</a>
      </footer>

    </div>
  );
}

// ======================================
// APP ENTRY POINT
// ======================================

const currentPath = location.pathname.replace(/\/+$/, "");

createRoot(document.getElementById("root")).render(
  currentPath === "/admin" ? <Admin /> : <Customer />
);

// DELETE ORDER — ADMIN ONLY
async function deleteOrder(order) {
  const confirmed = window.confirm(
    `Are you sure you want to delete order ${order.order_code}?`
  );

  if (!confirmed || !supabase) return;

  setError("");

  try {
    // Delete order record
   // Delete order from database
const { error: deleteError, count } = await supabase
  .from("orders")
  .delete({ count: "exact" })
  .eq("id", order.id);

if (deleteError) throw deleteError;

if (count === 0) {
  throw new Error(
    "Order not deleted. Check admin UID and DELETE policy."
  );
}

    // Delete payment screenshot from storage
    if (order.payment_screenshot_path) {
      const { error: storageError } = await supabase.storage
        .from("payment-screenshots")
        .remove([order.payment_screenshot_path]);

      if (storageError) {
        console.error(
          "Screenshot deletion failed:",
          storageError.message
        );
      }
    }

    // Update dashboard immediately
    setOrders((current) =>
      current.filter((item) => item.id !== order.id)
    );

    setImages((current) => {
      const updated = { ...current };
      delete updated[order.id];
      return updated;
    });
  } catch (error) {
    setError(error.message || "Unable to delete order.");
  }
}


createRoot(document.getElementById("root")).render(
  location.pathname.replace(/\/+$/, "") === "/admin"
    ? <Admin />
    : <Customer />
);