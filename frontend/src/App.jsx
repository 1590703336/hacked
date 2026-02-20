import { useState } from "react";
import HomePage from "./pages/HomePage";
import ReaderPage from "./pages/ReaderPage";
import TutorPage from "./pages/TutorPage";
import Navbar from "./components/layout/Navbar";
import "./App.css";

export default function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [capturedContent, setCapturedContent] = useState(null);

  const navigate = (page, data = null) => {
    if (data) setCapturedContent(data);
    setCurrentPage(page);
  };

  return (
    <div className="app-shell">
      <Navbar currentPage={currentPage} navigate={navigate} />
      <main className="page-container">
        {currentPage === "home" && <HomePage navigate={navigate} />}
        {currentPage === "reader" && <ReaderPage content={capturedContent} navigate={navigate} />}
        {currentPage === "tutor" && <TutorPage content={capturedContent} navigate={navigate} />}
      </main>
    </div>
  );
}
