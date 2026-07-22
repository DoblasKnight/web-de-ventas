/* ── Supabase ── */
const SUPABASE_URL = "https://tarjzxcexcgtsinwmqkk.supabase.co";
const SUPABASE_KEY = "sb_publishable_VPyMBdtvxiUtBmDeT70Q8A_mun-ifJS";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const catLabels = {
  celulares: "Celular",
  portatiles: "Portátil",
  electrodomesticos: "Electro",
};

let products = [];
let cart = [];
let currentFilter = "all";
let cartOpen = false;
let currentUser = null; // { id, email, name, role }

/* ── Auth ── */
function openLogin() {
  document.getElementById("loginError").style.display = "none";
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
  document.getElementById("loginModal").classList.add("open");
}

function closeLogin(e) {
  if (!e || e.target === document.getElementById("loginModal")) {
    document.getElementById("loginModal").classList.remove("open");
  }
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    document.getElementById("loginError").style.display = "block";
    return;
  }

  await loadCurrentUser(data.user);
  document.getElementById("loginModal").classList.remove("open");
  renderHeader();
  renderAdminBanner();
  renderProducts();
  showToast(
    `¡Hola, ${currentUser.name}! ${currentUser.role === "admin" ? "👑" : "👋"}`,
  );
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  renderHeader();
  renderAdminBanner();
  renderProducts();
  showToast("Sesión cerrada. ¡Hasta pronto!");
}

async function loadCurrentUser(authUser) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", authUser.id)
    .single();

  currentUser = {
    id: authUser.id,
    email: authUser.email,
    name: profile?.name || authUser.email.split("@")[0],
    role: profile?.role || "cliente",
  };
}

async function restoreSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    await loadCurrentUser(session.user);
  }
}

function renderHeader() {
  const el = document.getElementById("headerAuth");
  if (!currentUser) {
    el.innerHTML = `<button class="btn-login" onclick="openLogin()">Iniciar sesión</button>`;
  } else {
    const initials = currentUser.name.charAt(0).toUpperCase();
    el.innerHTML = `
        <div class="user-badge">
          <div class="user-avatar ${currentUser.role}">${initials}</div>
          <span class="user-name">${currentUser.name}</span>
          <span class="role-tag ${currentUser.role}">${currentUser.role}</span>
          <button class="btn-logout" onclick="logout()" title="Cerrar sesión">✕</button>
        </div>`;
  }
}

function renderAdminBanner() {
  const b = document.getElementById("adminBanner");
  b.classList.toggle("visible", currentUser?.role === "admin");
}

/* ── Products ── */
async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("id");

  if (error) {
    showToast("Error cargando productos");
    return;
  }
  products = data;
  renderProducts();
}

function renderProducts() {
  const container = document.getElementById("products");
  const filtered =
    currentFilter === "all"
      ? products
      : products.filter((p) => p.category === currentFilter);
  const isAdmin = currentUser?.role === "admin";

  container.innerHTML = filtered
    .map(
      (p, i) => `
      <div class="card" style="animation-delay:${i * 0.07}s">
        <div class="card-img" onclick="openProductModal(${p.id})" style="cursor:pointer">
          <img src="${p.img}" alt="${p.name}" loading="lazy" />
          <span class="card-cat">${catLabels[p.category]}</span>
          <div class="card-admin-actions ${isAdmin ? "visible" : ""}">
            <button class="btn-admin-action" title="Editar" onclick="event.stopPropagation(); adminAction('edit',${p.id})">✏️</button>
            <button class="btn-admin-action" title="Eliminar" onclick="event.stopPropagation(); adminAction('delete',${p.id})">🗑️</button>
          </div>
        </div>
        <div class="card-body">
          <div class="card-name" onclick="openProductModal(${p.id})" style="cursor:pointer">${p.name}</div>
          <div style="font-size:12px; color:var(--muted); margin-top:2px;">${p.specs[0]} · ${p.specs[1]}</div>
          <div class="card-price">$${Number(p.price).toLocaleString()} <span>COP</span></div>
          <div style="display:flex;gap:8px;margin-top:auto">
            <button class="btn-add" style="flex:1" onclick="addToCart(${p.id})">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Agregar
            </button>
            <button class="btn-add" style="background:var(--surface2);width:42px;padding:0;flex-shrink:0" onclick="openProductModal(${p.id})" title="Ver detalles">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
          </div>
        </div>
      </div>
    `,
    )
    .join("");
}

function filterProducts(cat, btn) {
  currentFilter = cat;
  document
    .querySelectorAll(".filter-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderProducts();
}

/* ── Product Modal ── */
function openProductModal(id) {
  const p = products.find((p) => p.id === id);
  document.getElementById("pmImg").src = p.img;
  document.getElementById("pmImg").alt = p.name;
  document.getElementById("pmCat").textContent = catLabels[p.category];
  document.getElementById("pmName").textContent = p.name;
  document.getElementById("pmDesc").textContent = p.description;
  document.getElementById("pmPrice").innerHTML =
    `$${Number(p.price).toLocaleString()} <small>COP</small>`;
  document.getElementById("pmSpecs").innerHTML = p.specs
    .map((s) => `<span class="pm-spec">${s}</span>`)
    .join("");
  document.getElementById("pmCartBtn").onclick = () => {
    addToCart(p.id);
    closeProductModal();
  };
  document.getElementById("productModal").classList.add("open");
}

function closeProductModal(e) {
  if (!e || e.target === document.getElementById("productModal")) {
    document.getElementById("productModal").classList.remove("open");
  }
}

/* ── Admin actions ── */
async function adminAction(type, id) {
  const p = products.find((p) => p.id === id);

  if (type === "delete") {
    if (!confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      showToast("No se pudo eliminar (¿permisos?)");
      return;
    }
    showToast(`🗑️ Eliminado: ${p.name}`);
    await loadProducts();
  }

  if (type === "edit") {
    const newName = prompt("Nombre del producto:", p.name);
    if (newName === null) return;
    const newPriceStr = prompt("Precio (COP):", p.price);
    if (newPriceStr === null) return;
    const newPrice = Number(newPriceStr);
    if (!newName.trim() || Number.isNaN(newPrice)) {
      showToast("Datos inválidos");
      return;
    }

    const { error } = await supabase
      .from("products")
      .update({ name: newName.trim(), price: newPrice })
      .eq("id", id);

    if (error) {
      showToast("No se pudo editar (¿permisos?)");
      return;
    }
    showToast(`✏️ Actualizado: ${newName}`);
    await loadProducts();
  }
}

/* ── Cart ── */
function addToCart(id) {
  const p = products.find((p) => p.id === id);
  cart.push({ ...p, uid: Date.now() });
  renderCart();
  showToast(`${p.name} agregado 🛒`);
  if (!cartOpen) toggleCart();
}

function removeFromCart(uid) {
  cart = cart.filter((i) => i.uid !== uid);
  renderCart();
}

function renderCart() {
  const el = document.getElementById("cartItems");
  const count = document.getElementById("cartCount");
  const total = document.getElementById("cartTotal");

  count.textContent = cart.length;
  total.textContent =
    "$" + cart.reduce((s, i) => s + Number(i.price), 0).toLocaleString();

  if (!cart.length) {
    el.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛒</div><p>Tu carrito está vacío</p></div>`;
    return;
  }

  el.innerHTML = cart
    .map(
      (item) => `
      <div class="cart-item">
        <img class="cart-item-img" src="${item.img}" alt="${item.name}" />
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">$${Number(item.price).toLocaleString()}</div>
        </div>
        <button class="btn-remove" onclick="removeFromCart(${item.uid})">✕</button>
      </div>
    `,
    )
    .join("");
}

function toggleCart() {
  cartOpen = !cartOpen;
  document
    .getElementById("cartDrawer")
    .classList.toggle("open", cartOpen);
}

function showToast(msg) {
  const t = document.getElementById("toast");
  document.getElementById("toastMsg").textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

async function checkout() {
  if (!cart.length) {
    showToast("Agrega productos primero");
    return;
  }
  if (!currentUser) {
    showToast("Inicia sesión para finalizar la compra");
    openLogin();
    return;
  }

  const total = cart.reduce((s, i) => s + Number(i.price), 0);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ user_id: currentUser.id, total })
    .select()
    .single();

  if (orderError) {
    showToast("No se pudo crear el pedido");
    return;
  }

  const items = cart.map((i) => ({
    order_id: order.id,
    product_id: i.id,
    product_name: i.name,
    price: i.price,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(items);

  if (itemsError) {
    showToast("Pedido creado, pero hubo un error guardando los ítems");
  } else {
    showToast(`Pedido #${order.id} confirmado ✓`);
  }

  cart = [];
  renderCart();
  toggleCart();
}

/* ── Init ── */
(async function init() {
  await restoreSession();
  renderHeader();
  renderAdminBanner();
  await loadProducts();
})();
