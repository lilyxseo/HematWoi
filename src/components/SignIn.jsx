import { useState } from "react";
import Modal from "./Modal";
import { supabase } from "../lib/supabase";

export default function SignIn({ open, onClose }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setMessage("Cek email untuk link masuk.");
      setCooldown(true);
      setTimeout(() => setCooldown(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title="Masuk HematWoi" onClose={onClose}>
      {message && <p className="text-success text-sm mb-2">{message}</p>}
      {error && <p className="text-danger text-sm mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="email"
          className="input w-full"
          placeholder="emailmu@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={loading || cooldown}
        >
          {loading ? "Mengirim..." : "Kirim Link Masuk"}
        </button>
      </form>
    </Modal>
  );
}
