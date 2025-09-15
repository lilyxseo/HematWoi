import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listCategories, listTransactions } from "../lib/api";

const defaults = {
  type: "all",
  month: "all",
  category: "all",
  sort: "date-desc",
  q: "",
};

export default function useTransactionsQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [months, setMonths] = useState([]);
  const [categories, setCategories] = useState([]);

  const filter = useMemo(() => {
    const obj = { ...defaults };
    Object.keys(defaults).forEach((k) => {
      const v = searchParams.get(k);
      if (v) obj[k] = v;
    });
    return obj;
  }, [searchParams]);

  const setFilter = useCallback(
    (patch) => {
      const next = { ...filter, ...patch };
      const params = new URLSearchParams(searchParams);
      Object.keys(defaults).forEach((k) => {
        const v = next[k];
        if (v === defaults[k] || v === "" || v == null) {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      });
      setSearchParams(params, { replace: true });
    },
    [filter, searchParams, setSearchParams]
  );

  useEffect(() => {
    listTransactions(filter).then(({ rows }) => {
      setItems(rows);
      const m = new Set(rows.map((r) => r.date.slice(0, 7)));
      setMonths(Array.from(m).sort().reverse());
    });
  }, [filter]);

  useEffect(() => {
    listCategories().then(setCategories);
  }, []);

  return { items, months, categories, filter, setFilter };
}
