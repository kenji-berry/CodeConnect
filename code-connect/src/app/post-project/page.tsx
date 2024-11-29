import React from "react";
import NavBar from "../Components/NavBar";
import "./style.css";

const page = () => {
  return (
    <div className="w-screen h-screen radial-background flex flex-col items-center">
      <NavBar />
      <h1 className="project-page-project-name">Project Name</h1>
      <div className="bento-container w-full inria-sans-regular">
        <div className="bento-box full-width radial-background">
          Write your own project description or use existing README?
        </div>
        <div className="bento-box half-width radial-background">
          Tech Stack:
        </div>
        <div className="bento-box half-width radial-background">Tags:</div>
        <div className="full-width">
          <h2>READ ONLY Project Information (as of xx/xx/xx)</h2>
        </div>

        <div className="bento-box half-width radial-background">Owner:</div>
        <div className="bento-box half-width radial-background">
          Issues Open:
        </div>
        <div className="bento-box full-width radial-background">
          Recent Activity:
        </div>
      </div>
    </div>
  );
};

export default page;
