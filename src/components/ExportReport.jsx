import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function ExportReport({
  month,
  kpi = {},
  byCategory = [],
  byDay = [],
  budgetsForMonth = [],
}) {
  const exportCSV = () => {
    try {
      const lines = [];
      lines.push("KPI");
      lines.push("Metric,Value");
      lines.push(`Pemasukan,${kpi.income || 0}`);
      lines.push(`Pengeluaran,${kpi.expense || 0}`);
      lines.push(`Saldo,${kpi.balance || 0}`);
      lines.push(`Savings Rate,${((kpi.savings || 0) * 100).toFixed(2)}%`);
      lines.push("");
      lines.push("Per Kategori");
      lines.push("Kategori,Total");
      byCategory.forEach((c) => lines.push(`${c.category},${c.total}`));
      lines.push("");
      lines.push("Per Hari");
      lines.push("Tanggal,Pemasukan,Pengeluaran");
      byDay.forEach((d) => lines.push(`${d.date},${d.income},${d.expense}`));
      lines.push("");
      lines.push("Budget");
      lines.push("Kategori,Limit,Terpakai,Sisa,Progress%");
      budgetsForMonth.forEach((b) =>
        lines.push(
          `${b.category},${b.cap},${b.used},${b.remaining},${Math.round(
            b.progress * 100
          )}`
        )
      );
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hematwoi-report-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Gagal export CSV: " + e.message);
    }
  };

  const exportPDF = async () => {
    try {
      const el = document.getElementById("report-capture");
      if (!el) throw new Error("Area laporan tidak ditemukan");
      const canvas = await html2canvas(el, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.setFontSize(10);
      pdf.text(
        `HematWoi • Laporan ${month} • ${new Date().toLocaleString("id-ID")}`,
        10,
        pdf.internal.pageSize.getHeight() - 10
      );
      pdf.save(`hematwoi-report-${month}.pdf`);
    } catch (e) {
      alert("Gagal export PDF: " + e.message);
    }
  };

  return (
    <div className="flex gap-2">
      <button className="btn" onClick={exportCSV}>
        Export CSV
      </button>
      <button className="btn" onClick={exportPDF}>
        Export PDF
      </button>
    </div>
  );
}
