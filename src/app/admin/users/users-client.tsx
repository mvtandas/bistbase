"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Shield,
  Trash2,
  UserCog,
} from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  plan: string;
  role: string;
  createdAt: string;
  _count: { portfolios: number };
}

interface UserDetail extends UserRow {
  aiDisclaimerAccepted: boolean;
  portfolios: { stockCode: string; quantity: number | null; avgCost: number | null; addedAt: string }[];
  alertPrefs: {
    morningDigest: boolean;
    signalAlerts: boolean;
    scoreChangeAlerts: boolean;
    macroAlerts: boolean;
    weeklyReport: boolean;
  } | null;
}

export function UsersClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (planFilter) params.set("plan", planFilter);
    if (roleFilter) params.set("role", roleFilter);
    params.set("page", String(page));

    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users);
    setTotal(data.total);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, [search, planFilter, roleFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    const res = await fetch(`/api/admin/users/${id}`);
    const data = await res.json();
    setSelectedUser(data);
    setDetailLoading(false);
  };

  const updateUser = async (id: string, field: string, value: string) => {
    setActionLoading(id);
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setActionLoading(null);
    fetchUsers();
    if (selectedUser?.id === id) {
      setSelectedUser((prev) => prev ? { ...prev, [field]: value } : null);
    }
  };

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`${email} kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;
    setActionLoading(id);
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setActionLoading(null);
    setSelectedUser(null);
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Kullanıcılar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total} kullanıcı kayıtlı
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Email ile ara..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border/50 bg-card/20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-border/50 bg-card/20 text-sm text-foreground focus:outline-none"
        >
          <option value="">Tüm Planlar</option>
          <option value="FREE">Free</option>
          <option value="PREMIUM">Premium</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-border/50 bg-card/20 text-sm text-foreground focus:outline-none"
        >
          <option value="">Tüm Roller</option>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-xl border border-border/25 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/25 bg-card/10">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Portföy</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kayıt</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-border/10 hover:bg-card/20 cursor-pointer transition-colors"
                  onClick={() => openDetail(user.id)}
                >
                  <td className="px-4 py-3 text-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.plan === "PREMIUM"
                        ? "bg-amber-400/10 text-amber-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {user.plan === "PREMIUM" && <Crown className="h-3 w-3" />}
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.role === "ADMIN"
                        ? "bg-orange-400/10 text-orange-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {user.role === "ADMIN" && <Shield className="h-3 w-3" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user._count.portfolios}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => updateUser(user.id, "plan", user.plan === "FREE" ? "PREMIUM" : "FREE")}
                        disabled={actionLoading === user.id}
                        className="p-1.5 rounded-md hover:bg-card/40 text-muted-foreground hover:text-foreground transition-colors"
                        title="Plan değiştir"
                      >
                        <Crown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => updateUser(user.id, "role", user.role === "USER" ? "ADMIN" : "USER")}
                        disabled={actionLoading === user.id}
                        className="p-1.5 rounded-md hover:bg-card/40 text-muted-foreground hover:text-foreground transition-colors"
                        title="Rol değiştir"
                      >
                        <UserCog className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.email)}
                        disabled={actionLoading === user.id}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Kullanıcı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Sayfa {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-border/25 hover:bg-card/20 disabled:opacity-30 text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-border/25 hover:bg-card/20 disabled:opacity-30 text-muted-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* User detail modal */}
      {(selectedUser || detailLoading) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border/50 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 space-y-4">
            {detailLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : selectedUser ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Kullanıcı Detayı</h2>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-muted-foreground hover:text-foreground text-sm"
                  >
                    Kapat
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-foreground">{selectedUser.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="text-foreground">{selectedUser.plan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rol</span>
                    <span className="text-foreground">{selectedUser.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kayıt Tarihi</span>
                    <span className="text-foreground">
                      {new Date(selectedUser.createdAt).toLocaleDateString("tr-TR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">AI Disclaimer</span>
                    <span className="text-foreground">
                      {selectedUser.aiDisclaimerAccepted ? "Kabul Edildi" : "Kabul Edilmedi"}
                    </span>
                  </div>
                </div>

                {/* Portfolio */}
                {selectedUser.portfolios.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-2">
                      Portföy ({selectedUser.portfolios.length} hisse)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.portfolios.map((p) => (
                        <span
                          key={p.stockCode}
                          className="px-2 py-1 rounded-md bg-card/30 border border-border/25 text-xs text-foreground"
                        >
                          {p.stockCode}
                          {p.quantity != null && ` (${p.quantity} lot)`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alert prefs */}
                {selectedUser.alertPrefs && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground mb-2">
                      Bildirim Tercihleri
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { key: "morningDigest", label: "Sabah Özeti" },
                        { key: "signalAlerts", label: "Sinyal Uyarıları" },
                        { key: "scoreChangeAlerts", label: "Skor Değişim" },
                        { key: "macroAlerts", label: "Makro Uyarılar" },
                        { key: "weeklyReport", label: "Haftalık Rapor" },
                      ].map((pref) => (
                        <div key={pref.key} className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              (selectedUser.alertPrefs as Record<string, boolean>)?.[pref.key]
                                ? "bg-green-400"
                                : "bg-red-400"
                            }`}
                          />
                          <span className="text-muted-foreground">{pref.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => updateUser(selectedUser.id, "plan", selectedUser.plan === "FREE" ? "PREMIUM" : "FREE")}
                    className="flex-1 px-3 py-2 rounded-lg bg-amber-400/10 text-amber-400 text-sm font-medium hover:bg-amber-400/20 transition-colors"
                  >
                    {selectedUser.plan === "FREE" ? "Premium Yap" : "Free Yap"}
                  </button>
                  <button
                    onClick={() => deleteUser(selectedUser.id, selectedUser.email)}
                    className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                  >
                    Sil
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
