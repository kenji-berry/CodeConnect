"use client";
import React from "react";
import "../post-project/style.css";

const Page = () => {
  return (
    <div className="w-screen h-screen flex flex-col items-center">
      <div className="project-header w-full flex justify-center items-center">
        <div className="flex items-center gap-4">
          <h1 className="project-page-project-name relative">
            <a target="_blank" href="project">
              Project Name
            </a>
            <span className="absolute left-full h-full ml-3 mt-2">
              <div className="flex items-center gap-2 h-9">
                <div className="flex items-center gap-1">
                  <img src="/star.png" alt="star" className="h-9 w-9 star" />
                  <img src="/star.png" alt="star" className="h-9 w-9 star" />
                  <img src="/star.png" alt="star" className="h-9 w-9 star" />
                  <img src="/star.png" alt="star" className="h-9 w-9 star" />
                  <img src="/star.png" alt="star" className="h-9 w-9 star" />
                </div>
                <div className=" flex items-center h-9">
                  <img src="/fork.png" alt="fork" className="w-9 h-9 star" />
                  <p>20</p>
                </div>
              </div>
            </span>
          </h1>
        </div>
      </div>
      <div className="full-width">
        <h2 className="inria-sans-semibold">TAGS:</h2>
      </div>
      <div className="bento-container w-full inria-sans-regular">
        <div className="bento-box full-width radial-background">
          <div className="flex items-center">
            <span className="mr-2 inria-sans-semibold">
              Project Description/README
            </span>
          </div>
        </div>
        <div className="bento-box half-width radial-background">
          <h3>Project Details:</h3>
          <h4>Owner:</h4>
          <h4>License:</h4>
          <h4>Languages:</h4>
          <h4>Tech Stack:</h4>
          <h4>Recommended Skill Level:</h4>
          <h4>Repo Size:</h4>
          <h4>Contributors:</h4>
        </div>
        <div className="bento-box half-width radial-background">
          <h3>Contribution Information:</h3>
          <h4>Issues Open:</h4>
          <h4>Good First Issues:</h4>
          <h4>Pull Requests:</h4>
          <h4>Contribution Guidelines:</h4>
          <h4>Code of Conduct:</h4>
          <h4>Roadmap:</h4>
        </div>
        <div className="bento-box full-width radial-background">
          <h3 className="inria-sans-semibold">Recent Activity:</h3>
          <h4>Most Recent Commit:</h4>
          <div>
            <h4>Activity Graph:</h4>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
