import CodeConnectTitle from "./Components/CodeConnectTitle";
import Logo from "./Components/Logo";
import NavBar from "./Components/NavBar";
import ProjectPreview from "./Components/ProjectPreview";

export default function Home() {
  return (
    <div className="w-screen h-screen radial-background flex flex-col items-center">
      <NavBar />
      <CodeConnectTitle />
      <div className="main-page-contents">
        <div className="w-full">
          <h3 className="inter-bold">Recommended for you:</h3>
          <div className="main-page-recommended-holder">
            <ProjectPreview
              name="My Project"
              date="March 15, 2024"
              tags={["Frontend", "Open Source"]}
              description="A description of the project that takes up multiple lines and explains what the project does in detail."
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
              recommended={true}
            />
            <ProjectPreview
              name="My Project"
              date="March 15, 2024"
              tags={["Frontend", "Open Source"]}
              description="A description of the project that takes up multiple lines and explains what the project does in detail."
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
              recommended={true}
            />
            <ProjectPreview
              name="My Project"
              date="March 15, 2024"
              tags={["Frontend", "Open Source"]}
              description="A description of the project that takes up multiple lines and explains what the project does in detail."
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
              recommended={true}
            />
            <ProjectPreview
              name="My Project"
              date="March 15, 2024"
              tags={["Frontend", "Open Source"]}
              description="A description of the project that takes up multiple lines and explains what the project does in detail."
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
              recommended={true}
            />
            <ProjectPreview
              name="My Project"
              date="March 15, 2024"
              tags={["Frontend", "Open Source"]}
              description="A description of the project that takes up multiple lines and explains what the project does in detail."
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
              recommended={true}
            />
          </div>
        </div>

        <div className="w-full py-2">
          <h3 className="inter-bold">More Projects:</h3>
          <div className="w-full flex justify-evenly">
            <div className="w-1/2 mr-2">
              <h3 className="inter-bold">Filter By:</h3>
              <div className="main-page-filter-box radial-background"></div>
            </div>
            <div className="w-1/2 ml-2">
              <h3 className="inter-bold rad">Include These Tags:</h3>
              <div className="main-page-filter-box radial-background"></div>
            </div>
          </div>
        </div>
        <ProjectPreview
            name="Project Name"
            date="March 15, 2024"
            tags={["Project Tag", "Project Tag", "Project Tag"]}
            description="Project Description"
            techStack={["React", "TypeScript", "Tailwind"]}
            issueCount={5}
          />
      </div>
      <footer className="row-start-3 flex gap-6 flex-wrap justify-center"></footer>
    </div>
  );
}
