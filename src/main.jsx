import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx"
import "./index.css"   // kalau kamu pakai Tailwind, pastikan ada import ini
import AuthGate from "./components/AuthGate.jsx"  // kalau kamu sudah buat AuthGate

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </React.StrictMode>,
)
