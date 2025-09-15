import ManageCategories from "../components/ManageCategories";

export default function Categories({ cat, onSave }) {
  return (
    <main className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="card">
        <h1 className="text-sm font-semibold">Kategori</h1>
      </div>
      <ManageCategories cat={cat} onSave={onSave} />
    </main>
  );
}
