/* ── Supabase ── */
const SUPABASE_URL = "https://tarjzxcexcgtsinwmqkk.supabase.co";
const SUPABASE_KEY = "sb_publishable_VPyMBdtvxiUtBmDeT70Q8A_mun-ifJS";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const KNOWN_CATEGORY_META = {
  celulares: { badge: "Celular", filter: "📱 Celulares" },
  portatiles: { badge: "Portátil", filter: "💻 Portátiles" },
  electrodomesticos: { badge: "Electro", filter: "🏠 Electrodomésticos" },
};

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function categoryBadge(cat) {
  return KNOWN_CATEGORY_META[cat]?.badge || capitalize(cat);
}

function categoryFilterLabel(cat) {
  return KNOWN_CATEGORY_META[cat]?.filter || capitalize(cat);
}

let products = [];
let cart = [];
let currentFilter = "all";
let cartOpen = false;
let currentUser = null; // { id, email, name, role }
let authMode = "login"; // "login" | "signup"

/* ── Auth ── */
function openLogin() {
  authMode = "login";
  applyAuthMode();
  document.getElementById("name").value = "";
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
  document.getElementById("password").type = "password";
  document.getElementById("pwIconEye").style.display = "block";
  document.getElementById("pwIconEyeOff").style.display = "none";
  document.getElementById("loginModal").classList.add("open");
}

function closeLogin() {
  document.getElementById("loginModal").classList.remove("open");
}

function toggleAuthMode() {
  authMode = authMode === "login" ? "signup" : "login";
  applyAuthMode();
}

function applyAuthMode() {
  const isSignup = authMode === "signup";
  document.getElementById("loginError").style.display = "none";
  document.getElementById("authSubtitle").textContent = isSignup
    ? "Crea tu cuenta para empezar a comprar"
    : "Accede a tu cuenta para continuar";
  document.getElementById("nameGroup").style.display = isSignup
    ? "block"
    : "none";
  document.getElementById("pwRules").style.display = isSignup
    ? "flex"
    : "none";
  document.getElementById("authSubmitBtn").textContent = isSignup
    ? "Crear cuenta →"
    : "Ingresar →";
  document.getElementById("authSwitchText").textContent = isSignup
    ? "¿Ya tienes cuenta?"
    : "¿No tienes cuenta?";
  document.getElementById("authSwitchBtn").textContent = isSignup
    ? "Inicia sesión"
    : "Crear cuenta";
  updatePasswordStrength();
}

function openConfirmEmailModal(email) {
  document.getElementById("confirmEmailAddress").textContent = email;
  document.getElementById("confirmEmailModal").classList.add("open");
}

function closeConfirmEmailModal() {
  document.getElementById("confirmEmailModal").classList.remove("open");
}

function togglePasswordVisibility() {
  const input = document.getElementById("password");
  const btn = document.getElementById("togglePwBtn");
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  document.getElementById("pwIconEye").style.display = showing ? "block" : "none";
  document.getElementById("pwIconEyeOff").style.display = showing ? "none" : "block";
  btn.title = showing ? "Mostrar contraseña" : "Ocultar contraseña";
}

/* ── Password strength ── */
const PASSWORD_RULES = [
  { id: "pwRuleLen", test: (v) => v.length >= 8 },
  { id: "pwRuleUpper", test: (v) => /[A-Z]/.test(v) },
  { id: "pwRuleNumber", test: (v) => /[0-9]/.test(v) },
  { id: "pwRuleSymbol", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function isPasswordSecure(pw) {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

function updatePasswordStrength() {
  const pw = document.getElementById("password").value;
  PASSWORD_RULES.forEach((r) => {
    document.getElementById(r.id).classList.toggle("met", r.test(pw));
  });
}

function showAuthError(msg) {
  const el = document.getElementById("loginError");
  el.textContent = `❌ ${msg}`;
  el.style.display = "block";
}

async function submitAuth() {
  if (authMode === "signup") {
    await signup();
  } else {
    await login();
  }
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    showAuthError("Correo o contraseña incorrectos");
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

async function signup() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!name || !email || !password) {
    showAuthError("Completa nombre, correo y contraseña");
    return;
  }

  if (!isPasswordSecure(password)) {
    showAuthError("La contraseña no cumple los requisitos de seguridad");
    return;
  }

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    showAuthError(error.message);
    return;
  }

  if (!data.session) {
    document.getElementById("loginModal").classList.remove("open");
    openConfirmEmailModal(email);
    return;
  }

  await loadCurrentUser(data.user);
  document.getElementById("loginModal").classList.remove("open");
  renderHeader();
  renderAdminBanner();
  renderProducts();
  showToast(`¡Bienvenido, ${currentUser.name}! 👋`);
}

async function logout() {
  await db.auth.signOut();
  currentUser = null;
  renderHeader();
  renderAdminBanner();
  renderProducts();
  showToast("Sesión cerrada. ¡Hasta pronto!");
}

async function loadCurrentUser(authUser) {
  const { data: profile } = await db
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
  } = await db.auth.getSession();
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
    const isAdmin = currentUser.role === "admin";
    el.innerHTML = `
        <div class="user-badge">
          <div class="user-avatar ${currentUser.role}">${initials}</div>
          <span class="user-name">${currentUser.name}</span>
          ${isAdmin ? `<span class="role-tag admin">admin</span>` : ""}
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
  const { data, error } = await db
    .from("products")
    .select("*")
    .order("id");

  if (error) {
    showToast("Error cargando productos");
    return;
  }
  products = data;

  const categories = [...new Set(products.map((p) => p.category))];
  if (currentFilter !== "all" && !categories.includes(currentFilter)) {
    currentFilter = "all";
  }

  renderFilters();
  renderProducts();
}

function renderFilters() {
  const container = document.getElementById("filters");
  const categories = [...new Set(products.map((p) => p.category))].sort();

  container.innerHTML = `
    <button class="filter-btn ${currentFilter === "all" ? "active" : ""}" onclick="filterProducts('all', this)">Todos</button>
    ${categories
      .map(
        (cat) => `
      <button class="filter-btn ${currentFilter === cat ? "active" : ""}" onclick="filterProducts('${cat}', this)">
        ${categoryFilterLabel(cat)}
      </button>`,
      )
      .join("")}
  `;
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
          <span class="card-cat">${categoryBadge(p.category)}</span>
          <div class="card-admin-actions ${isAdmin ? "visible" : ""}">
            <button class="btn-admin-action" title="Editar" onclick="event.stopPropagation(); adminAction('edit',${p.id})">✏️</button>
            <button class="btn-admin-action" title="Eliminar" onclick="event.stopPropagation(); adminAction('delete',${p.id})">🗑️</button>
          </div>
        </div>
        <div class="card-body">
          <div class="card-name" onclick="openProductModal(${p.id})" style="cursor:pointer">${p.name}</div>
          <div style="font-size:12px; color:var(--muted); margin-top:2px;">${p.specs.slice(0, 2).join(" · ")}</div>
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
  document.getElementById("pmCat").textContent = categoryBadge(p.category);
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
function adminAction(type, id) {
  const p = products.find((p) => p.id === id);

  if (type === "delete") {
    openDeleteProductModal(p);
  }

  if (type === "edit") {
    openEditProductModal(p);
  }
}

/* ── Delete Product Modal ── */
let deletingProductId = null;

function openDeleteProductModal(p) {
  deletingProductId = p.id;
  document.getElementById("deleteProductName").textContent = p.name;
  document.getElementById("deleteProductModal").classList.add("open");
}

function closeDeleteProductModal() {
  document.getElementById("deleteProductModal").classList.remove("open");
  deletingProductId = null;
}

async function confirmDeleteProduct() {
  const p = products.find((p) => p.id === deletingProductId);
  const { data, error } = await db
    .from("products")
    .delete()
    .eq("id", deletingProductId)
    .select();

  closeDeleteProductModal();

  if (error || !data || data.length === 0) {
    showToast("No se pudo eliminar (¿permisos?)");
    return;
  }
  showToast(`🗑️ Eliminado: ${p.name}`);
  await loadProducts();
}

/* ── Edit / Create Product Modal ── */
let editingProductId = null; // null = modo "crear"
let editImgUrl = null; // URL ya subida (edición) o null (crear, hasta subir)

function populateCategoryOptions() {
  const dl = document.getElementById("categoryOptions");
  const categories = [...new Set(products.map((p) => p.category))].sort();
  dl.innerHTML = categories.map((c) => `<option value="${c}"></option>`).join("");
}

function resetEditImagePicker(currentUrl) {
  editImgUrl = currentUrl || null;
  document.getElementById("editImgFile").value = "";
  const preview = document.getElementById("editImgPreview");
  if (currentUrl) {
    preview.src = currentUrl;
    preview.style.display = "block";
  } else {
    preview.src = "";
    preview.style.display = "none";
  }
}

function openEditProductModal(p) {
  editingProductId = p.id;
  document.getElementById("editModalTitle").textContent = "Editar producto";
  document.getElementById("editModalSubtitle").textContent =
    "Actualiza la información y guarda los cambios.";
  document.getElementById("editSubmitBtn").textContent = "Guardar cambios →";
  document.getElementById("editProductError").style.display = "none";
  document.getElementById("editName").value = p.name;
  document.getElementById("editCategory").value = p.category;
  document.getElementById("editPrice").value = p.price;
  document.getElementById("editDescription").value = p.description || "";
  document.getElementById("editSpecs").value = p.specs.join("\n");
  resetEditImagePicker(p.img);
  populateCategoryOptions();
  document.getElementById("editProductModal").classList.add("open");
}

function openCreateProductModal() {
  editingProductId = null;
  document.getElementById("editModalTitle").textContent = "Nuevo producto";
  document.getElementById("editModalSubtitle").textContent =
    "Completa la información del producto.";
  document.getElementById("editSubmitBtn").textContent = "Crear producto →";
  document.getElementById("editProductError").style.display = "none";
  document.getElementById("editName").value = "";
  document.getElementById("editCategory").value = "";
  document.getElementById("editPrice").value = "";
  document.getElementById("editDescription").value = "";
  document.getElementById("editSpecs").value = "";
  resetEditImagePicker(null);
  populateCategoryOptions();
  document.getElementById("editProductModal").classList.add("open");
}

function closeEditProductModal() {
  document.getElementById("editProductModal").classList.remove("open");
  editingProductId = null;
  editImgUrl = null;
}

function previewProductImage() {
  const file = document.getElementById("editImgFile").files[0];
  if (!file) return;
  const preview = document.getElementById("editImgPreview");
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
}

function showEditProductError(msg) {
  const el = document.getElementById("editProductError");
  el.textContent = `❌ ${msg}`;
  el.style.display = "block";
}

async function uploadProductImage(file) {
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await db.storage.from("product-images").upload(path, file);
  if (error) throw error;
  const { data } = db.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

async function saveProductEdit() {
  const isEdit = editingProductId !== null;
  const submitBtn = document.getElementById("editSubmitBtn");
  const defaultLabel = isEdit ? "Guardar cambios →" : "Crear producto →";

  const name = document.getElementById("editName").value.trim();
  const category = document
    .getElementById("editCategory")
    .value.trim()
    .toLowerCase();
  const price = Number(document.getElementById("editPrice").value);
  const description = document.getElementById("editDescription").value.trim();
  const specs = document
    .getElementById("editSpecs")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const file = document.getElementById("editImgFile").files[0];

  if (!name || !category || Number.isNaN(price) || price < 0) {
    showEditProductError("Completa nombre, categoría y un precio válido");
    return;
  }
  if (specs.length === 0) {
    showEditProductError("Agrega al menos una especificación");
    return;
  }
  if (!file && !editImgUrl) {
    showEditProductError("Selecciona una imagen para el producto");
    return;
  }

  let img = editImgUrl;
  if (file) {
    submitBtn.textContent = "Subiendo imagen...";
    try {
      img = await uploadProductImage(file);
    } catch (e) {
      showEditProductError("No se pudo subir la imagen (¿permisos?)");
      submitBtn.textContent = defaultLabel;
      return;
    }
  }

  const payload = { name, category, price, img, description, specs };
  const query = isEdit
    ? db.from("products").update(payload).eq("id", editingProductId).select()
    : db.from("products").insert(payload).select();

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    showEditProductError("No se pudo guardar (¿permisos?)");
    submitBtn.textContent = defaultLabel;
    return;
  }

  closeEditProductModal();
  showToast(isEdit ? `✏️ Actualizado: ${name}` : `✅ Producto creado: ${name}`);
  await loadProducts();
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

  const { data: order, error: orderError } = await db
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

  const { error: itemsError } = await db.from("order_items").insert(items);

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
