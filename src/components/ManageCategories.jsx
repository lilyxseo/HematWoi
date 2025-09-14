import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ColorDot from "./ColorDot";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

function Item({ item, onNameChange, onNameBlur, onColorChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 justify-between border rounded-lg px-2 py-1 bg-white"
    >
      <div className="flex items-center gap-2 flex-1">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
        >
          ⋮⋮
        </span>
        <ColorDot color={item.color} />
        <input
          className="flex-1 bg-transparent outline-none"
          value={item.name}
          onChange={(e) => onNameChange(item.id, e.target.value)}
          onBlur={(e) => onNameBlur(item.id, e.target.value)}
        />
      </div>
      <input
        type="color"
        value={item.color}
        onChange={(e) => onColorChange(item.id, e.target.value)}
        className="h-6 w-6"
      />
      <button onClick={() => onRemove(item.id)} className="text-red-500">
        ✕
      </button>
    </div>
  );
}

export default function ManageCategories({ cat, onSave }) {
  const meta = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("hematwoi:v3:catMeta")) || {};
    } catch {
      return {};
    }
  }, []);

  const makeList = (names = [], type) =>
    [...names]
      .sort((a, b) => (meta[a]?.sort ?? 0) - (meta[b]?.sort ?? 0))
      .map((name, idx) => ({
        id: uid(),
        name,
        orig: name,
        color: meta[name]?.color || "#64748b",
        type,
        sort: idx,
      }));

  const [listIncome, setListIncome] = useState(() =>
    makeList(cat?.income || [], "income")
  );
  const [listExpense, setListExpense] = useState(() =>
    makeList(cat?.expense || [], "expense")
  );
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("income");
  const [newColor, setNewColor] = useState("#3898f8");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (listIncome.some((i) => i.id === active.id)) {
      setListIncome((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex).map((it, idx) => ({
          ...it,
          sort: idx,
        }));
      });
    } else {
      setListExpense((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex).map((it, idx) => ({
          ...it,
          sort: idx,
        }));
      });
    }
  };

  const removeItem = (id) => {
    setListIncome((arr) =>
      arr.filter((i) => i.id !== id).map((it, idx) => ({ ...it, sort: idx }))
    );
    setListExpense((arr) =>
      arr.filter((i) => i.id !== id).map((it, idx) => ({ ...it, sort: idx }))
    );
  };

  const changeColor = (id, color) => {
    setListIncome((arr) =>
      arr.map((i) => (i.id === id ? { ...i, color } : i))
    );
    setListExpense((arr) =>
      arr.map((i) => (i.id === id ? { ...i, color } : i))
    );
  };

  const changeName = (id, value) => {
    setListIncome((arr) =>
      arr.map((i) => (i.id === id ? { ...i, name: value } : i))
    );
    setListExpense((arr) =>
      arr.map((i) => (i.id === id ? { ...i, name: value } : i))
    );
  };

  const commitName = (id, value) => {
    const name = value.trim();
    const others = [...listIncome, ...listExpense]
      .filter((i) => i.id !== id)
      .map((i) => i.name.trim().toLowerCase());
    if (!name || others.includes(name.toLowerCase())) {
      setListIncome((arr) =>
        arr.map((i) => (i.id === id ? { ...i, name: i.orig } : i))
      );
      setListExpense((arr) =>
        arr.map((i) => (i.id === id ? { ...i, name: i.orig } : i))
      );
      return;
    }
    setListIncome((arr) =>
      arr.map((i) => (i.id === id ? { ...i, name, orig: name } : i))
    );
    setListExpense((arr) =>
      arr.map((i) => (i.id === id ? { ...i, name, orig: name } : i))
    );
  };

  const allNames = () =>
    [...listIncome, ...listExpense].map((c) => c.name.trim().toLowerCase());

  const addCategory = () => {
    const name = newName.trim();
    if (!name) return;
    if (allNames().includes(name.toLowerCase())) {
      alert("Nama kategori sudah ada");
      return;
    }
    const item = {
      id: uid(),
      name,
      orig: name,
      color: newColor,
      type: newType,
      sort: newType === "income" ? listIncome.length : listExpense.length,
    };
    if (newType === "income") setListIncome((arr) => [...arr, item]);
    else setListExpense((arr) => [...arr, item]);
    setNewName("");
    setNewColor("#3898f8");
  };

  const save = () => {
    const incomeDetail = listIncome.map((c, idx) => ({
      ...c,
      name: c.name.trim(),
      sort: idx,
    }));
    const expenseDetail = listExpense.map((c, idx) => ({
      ...c,
      name: c.name.trim(),
      sort: idx,
    }));
    const names = [...incomeDetail, ...expenseDetail].map((c) =>
      c.name.toLowerCase()
    );
    if (names.some((n) => !n) || new Set(names).size !== names.length) {
      alert("Nama kategori duplikat atau kosong");
      return;
    }
    onSave({
      income: incomeDetail.map((c) => c.name),
      expense: expenseDetail.map((c) => c.name),
    });
    window.dispatchEvent(
      new CustomEvent("hw:save-cat-meta", {
        detail: { income: incomeDetail, expense: expenseDetail },
      })
    );
  };

  return (
    <div className="card">
      <h2 className="font-semibold mb-2">Kelola Kategori</h2>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <h3 className="mb-1 text-sm font-medium">
              Pemasukan ({listIncome.length})
            </h3>
            <SortableContext
              items={listIncome.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {listIncome.map((item) => (
                  <Item
                    key={item.id}
                    item={item}
                    onNameChange={changeName}
                    onNameBlur={commitName}
                    onColorChange={changeColor}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium">
              Pengeluaran ({listExpense.length})
            </h3>
            <SortableContext
              items={listExpense.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {listExpense.map((item) => (
                  <Item
                    key={item.id}
                    item={item}
                    onNameChange={changeName}
                    onNameBlur={commitName}
                    onColorChange={changeColor}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        </div>
      </DndContext>
      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <input
          className="input flex-1"
          placeholder="Nama kategori"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select
          className="input"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        >
          <option value="income">Pemasukan</option>
          <option value="expense">Pengeluaran</option>
        </select>
        <input
          type="color"
          className="h-10 w-10"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
        />
        <button className="btn btn-primary" onClick={addCategory}>
          Tambah
        </button>
      </div>
      <div className="mt-4">
        <button className="btn btn-primary" onClick={save}>
          Simpan
        </button>
      </div>
    </div>
  );
}
