
import "./Header.css";
import logoTNV from "./tnv-logo.jpeg";

import { Link } from "react-router-dom";

const Header = () => {



  return (
    <div className="header">
      <Link to="/">
        <img src={logoTNV} alt="TNV" className="tnvLogo"></img>
      </Link>
      <div className="header-section2">
        <li><Link to="/">Net Values</Link></li>
        <li><Link to="/Stats">Player Stats</Link></li>
        <li><Link to="/AdvancedStats">Adv Stats</Link></li>
        <li><Link to="/Teams">NBA Teams</Link></li>
      </div>
    </div>
  );
};

export default Header;
