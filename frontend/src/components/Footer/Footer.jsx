import { Link } from "react-router-dom";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <strong>CallAI</strong>
        <p>AI Voice Calling Agent for Businesses</p>
        <Link to="/contact">Contact</Link>
      </div>
    </footer>
  );
}

export default Footer;
