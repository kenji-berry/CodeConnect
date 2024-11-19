import CodeConnectTitle from "./Components/CodeConnectTitle";
import Logo from "./Components/Logo";
import NavBar from "./Components/NavBar";
import ProjectPreview from "./Components/ProjectPreview";

export default function Home() {
  return (
    <div className="w-screen h-screen radial-background flex flex-col items-center">
      <NavBar />
      <CodeConnectTitle />
      <ProjectPreview
        name="Project Name"
        date="March 15, 2024"
        tags={["Project Tag", "Project Tag", "Project Tag"]}
        description="Project Description"
        techStack={["React", "TypeScript", "Tailwind"]}
        issueCount={5}
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
      <footer className="row-start-3 flex gap-6 flex-wrap justify-center"></footer>
    </div>
  );
}
