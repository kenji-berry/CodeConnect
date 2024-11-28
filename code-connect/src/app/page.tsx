import CodeConnectTitle from "./Components/CodeConnectTitle";
import Logo from "./Components/Logo";
import NavBar from "./Components/NavBar";
import ProjectPreview from "./Components/ProjectPreview";

export default function Home() {
  return (
    <div className="w-screen h-screen radial-background flex flex-col items-center">
      <NavBar />
      <CodeConnectTitle />
      <div>
        <h3 className="inter-bold">Recommended for you:</h3>
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

      <div>
        <h3 className="inter-bold">More Projects:</h3>
        <div>
          <div>
            <h3 className="inter-bold">Filter By:</h3>
          </div>
          <div>
            <h3 className="inter-bold">Include These Tags:</h3>
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
