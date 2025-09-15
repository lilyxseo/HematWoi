import { Link } from "react-router-dom";

export default function BankImportButton() {
  return (
    <Link to="/import" className="btn btn-primary">
      Import Mutasi Bank
    </Link>
  );
}
