

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Prenda = {
  id: string;
  code: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  talla: string | null;
  precio_compra: number;
  precio_venta: number;
  estado: "disponible" | "vendido";
  foto_url: string | null;
  created_at: string;
  sold_at: string | null;
};

const emptyForm = {
  nombre: "",
  marca: "",
  categoria: "",
  talla: "",
  precio_compra: "",
  precio_venta: ""
};

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authMessage, setAuthMessage] = useState("");
  const [items, setItems] = useState<Prenda[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingItem, setEditingItem] = useState<Prenda | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editStatus, setEditStatus] =
    useState<"disponible" | "vendido">("disponible");
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadItems();
  }, [session]);

  async function loadItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("prendas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setItems((data ?? []) as Prenda[]);
    setLoading(false);
  }

  async function auth() {
    setAuthMessage("");
    const result =
      authMode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) setAuthMessage(result.error.message);
    else
      setAuthMessage(
        authMode === "signup"
          ? "Cuenta creada. Revisa tu correo si Supabase solicita confirmación."
          : ""
      );
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!form.nombre.trim()) return setMessage("Escribe el nombre de la prenda.");
    setLoading(true);

    let foto_url: string | null = null;

    if (photo) {
      if (photo.size > 6 * 1024 * 1024) {
        setLoading(false);
        return setMessage("La foto debe pesar menos de 6 MB.");
      }
      const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const upload = await supabase.storage.from("ropa-fotos").upload(path, photo, {
        contentType: photo.type || "image/jpeg",
        cacheControl: "3600",
        upsert: false
      });
      if (upload.error) {
        setLoading(false);
        return setMessage(upload.error.message);
      }
      foto_url = supabase.storage.from("ropa-fotos").getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from("prendas").insert({
      nombre: form.nombre.trim(),
      marca: form.marca.trim() || null,
      categoria: form.categoria.trim() || null,
      talla: form.talla.trim() || null,
      precio_compra: Number(form.precio_compra || 0),
      precio_venta: Number(form.precio_venta || 0),
      foto_url
    });

    if (error) setMessage(error.message);
    else {
      setForm(emptyForm);
      setPhoto(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage("Prenda guardada correctamente.");
      await loadItems();
    }
    setLoading(false);
  }

  function openEdit(item: Prenda) {
    setEditingItem(item);
    setEditForm({
      nombre: item.nombre,
      marca: item.marca || "",
      categoria: item.categoria || "",
      talla: item.talla || "",
      precio_compra: String(item.precio_compra ?? ""),
      precio_venta: String(item.precio_venta ?? "")
    });
    setEditStatus(item.estado);
    setMessage("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;

    if (!editForm.nombre.trim())
      return setMessage("El nombre de la prenda es obligatorio.");

    if (editStatus === "vendido" && Number(editForm.precio_venta || 0) <= 0)
      return setMessage("Coloca el precio real de venta.");

    setLoading(true);
    setMessage("");

    const isSold = editStatus === "vendido";
    let sold_at = editingItem.sold_at;

    if (isSold && editingItem.estado !== "vendido")
      sold_at = new Date().toISOString();
    if (!isSold) sold_at = null;

    const { error } = await supabase
      .from("prendas")
      .update({
        nombre: editForm.nombre.trim(),
        marca: editForm.marca.trim() || null,
        categoria: editForm.categoria.trim() || null,
        talla: editForm.talla.trim() || null,
        precio_compra: Number(editForm.precio_compra || 0),
        precio_venta: Number(editForm.precio_venta || 0),
        estado: editStatus,
        sold_at
      })
      .eq("id", editingItem.id);

    if (error) setMessage(error.message);
    else {
      setEditingItem(null);
      setMessage("Prenda actualizada correctamente.");
      await loadItems();
    }
    setLoading(false);
  }

  async function removeItem(item: Prenda) {
    if (!confirm(`¿Eliminar ${item.code} - ${item.nombre}?`)) return;
    const { error } = await supabase.from("prendas").delete().eq("id", item.id);
    if (error) setMessage(error.message);
    else await loadItems();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const matchesStatus = statusFilter === "todos" || i.estado === statusFilter;
      const matchesSearch =
        !q ||
        [i.code, i.nombre, i.marca, i.categoria, i.talla]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [items, search, statusFilter]);

  const stats = useMemo(() => {
    const disponibles = items.filter((i) => i.estado === "disponible");
    const vendidos = items.filter((i) => i.estado === "vendido");
    const ventas = vendidos.reduce((s, i) => s + Number(i.precio_venta || 0), 0);
    const ganancia = vendidos.reduce(
      (s, i) => s + Number(i.precio_venta || 0) - Number(i.precio_compra || 0),
      0
    );
    return {
      total: items.length,
      disponibles: disponibles.length,
      vendidos: vendidos.length,
      ventas,
      ganancia
    };
  }, [items]);

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand">👕 <span>Inventario Ropa</span></div>
          <h1>{authMode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h1>
          <p className="muted">
            Tu inventario queda guardado en Supabase y puedes acceder desde celular o computadora.
          </p>
          <input placeholder="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="primary" onClick={auth}>
            {authMode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
          {authMessage && <p className="notice">{authMessage}</p>}
          <button className="link" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>
            {authMode === "login" ? "¿No tienes cuenta? Crear una" : "Ya tengo cuenta. Iniciar sesión"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">👕 <span>Inventario Ropa</span></div>
        <button className="secondary" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </header>

      <section className="dashboard">
        <div className="hero">
          <div><h1>Panel de inventario</h1><p>Registra, busca y controla tus prendas.</p></div>
          <span className="user">{session.user.email}</span>
        </div>

        <div className="stats">
          <Stat label="Prendas" value={stats.total} />
          <Stat label="Disponibles" value={stats.disponibles} />
          <Stat label="Vendidas" value={stats.vendidos} />
          <Stat label="Ventas" value={`S/ ${stats.ventas.toFixed(2)}`} />
          <Stat label="Ganancia" value={`S/ ${stats.ganancia.toFixed(2)}`} />
        </div>

        <div className="grid">
          <section className="card">
            <h2>➕ Nueva prenda</h2>
            <form onSubmit={addItem} className="form">
              <input required placeholder="Nombre *" value={form.nombre} onChange={(e) => setForm({...form, nombre:e.target.value})} />
              <div className="two">
                <input placeholder="Marca" value={form.marca} onChange={(e) => setForm({...form, marca:e.target.value})} />
                <input placeholder="Talla" value={form.talla} onChange={(e) => setForm({...form, talla:e.target.value})} />
              </div>
              <input placeholder="Categoría (polo, jean, casaca...)" value={form.categoria} onChange={(e) => setForm({...form, categoria:e.target.value})} />
              <div className="two">
                <input type="number" min="0" step="0.01" placeholder="Precio compra" value={form.precio_compra} onChange={(e) => setForm({...form, precio_compra:e.target.value})} />
                <input type="number" min="0" step="0.01" placeholder="Precio venta" value={form.precio_venta} onChange={(e) => setForm({...form, precio_venta:e.target.value})} />
              </div>
              <label className="file">📸 Foto <input ref={fileRef} type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
              <button className="primary" disabled={loading}>{loading ? "Guardando..." : "Guardar prenda"}</button>
              {message && <p className="notice">{message}</p>}
            </form>
          </section>

          <section className="card">
            <h2>🔎 Buscar inventario</h2>
            <div className="filters">
              <input placeholder="Código R001, nombre, marca..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="disponible">🟢 Disponibles</option>
                <option value="vendido">🔴 Vendidos</option>
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Foto</th><th>Código</th><th>Prenda</th><th>Compra</th><th>Venta</th><th>Ganancia</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.foto_url ? (
                          <img
                            className="thumb clickable-photo"
                            src={i.foto_url}
                            alt={i.nombre}
                            onClick={() => setViewPhoto(i.foto_url)}
                          />
                        ) : <span className="no-photo">—</span>}
                      </td>
                      <td><b>{i.code}</b></td>
                      <td><b>{i.nombre}</b><small>{[i.marca, i.talla, i.categoria].filter(Boolean).join(" · ")}</small></td>
                      <td>S/ {Number(i.precio_compra).toFixed(2)}</td>
                      <td>S/ {Number(i.precio_venta).toFixed(2)}</td>
                      <td>S/ {(Number(i.precio_venta)-Number(i.precio_compra)).toFixed(2)}</td>
                      <td>
                        <span className={`status ${i.estado}`}>
                          {i.estado === "disponible" ? "🟢 Disponible" : "🔴 Vendido"}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <button className="edit" onClick={() => openEdit(i)}>Editar</button>
                          <button className="danger" onClick={() => removeItem(i)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && filtered.length === 0 && <div className="empty">No hay prendas que coincidan con la búsqueda.</div>}
            </div>
          </section>
        </div>
      </section>

      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Editar prenda</h2>
              <button className="modal-close" onClick={() => setEditingItem(null)}>×</button>
            </div>

            <form onSubmit={saveEdit} className="form">
              <input required placeholder="Nombre *" value={editForm.nombre} onChange={(e) => setEditForm({...editForm, nombre:e.target.value})} />
              <div className="two">
                <input placeholder="Marca" value={editForm.marca} onChange={(e) => setEditForm({...editForm, marca:e.target.value})} />
                <input placeholder="Talla" value={editForm.talla} onChange={(e) => setEditForm({...editForm, talla:e.target.value})} />
              </div>
              <input placeholder="Categoría" value={editForm.categoria} onChange={(e) => setEditForm({...editForm, categoria:e.target.value})} />
              <div className="two">
                <input type="number" min="0" step="0.01" placeholder="Precio compra" value={editForm.precio_compra} onChange={(e) => setEditForm({...editForm, precio_compra:e.target.value})} />
                <input type="number" min="0" step="0.01" placeholder="Precio venta" value={editForm.precio_venta} onChange={(e) => setEditForm({...editForm, precio_venta:e.target.value})} />
              </div>

              <label className="field-label">Estado</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as "disponible" | "vendido")}>
                <option value="disponible">🟢 Disponible</option>
                <option value="vendido">🔴 Vendido</option>
              </select>

              {editStatus === "vendido" && (
                <div className="sale-info">
                  <strong>💰 Precio real de venta</strong>
                  <p>Coloca aquí el precio que realmente pagó el cliente.</p>
                  <input required type="number" min="0.01" step="0.01" placeholder="Ej. 45.00" value={editForm.precio_venta} onChange={(e) => setEditForm({...editForm, precio_venta:e.target.value})} />
                  {editForm.precio_venta && editForm.precio_compra && (
                    <p>Ganancia: <strong>S/ {(Number(editForm.precio_venta)-Number(editForm.precio_compra)).toFixed(2)}</strong></p>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setEditingItem(null)}>Cancelar</button>
                <button type="submit" className="primary" disabled={loading}>{loading ? "Guardando..." : "Guardar cambios"}</button>
              </div>
              {message && <p className="notice">{message}</p>}
            </form>
          </div>
        </div>
      )}

      {viewPhoto && (
        <div className="photo-overlay" onClick={() => setViewPhoto(null)}>
          <button className="photo-close" onClick={() => setViewPhoto(null)}>×</button>
          <img className="large-photo" src={viewPhoto} alt="Prenda" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </main>
  );
}

function Stat({label, value}:{label:string,value:string|number}) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>;
}

