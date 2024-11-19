import CodeConnectTitle from "./Components/CodeConnectTitle";
import Logo from "./Components/Logo";
import NavBar from "./Components/NavBar";

export default function Home() {
  return (
    <div className="w-screen h-screen radial-background flex flex-col items-center">
      <NavBar/>
      <CodeConnectTitle/>
      <footer className="row-start-3 flex gap-6 flex-wrap justify-center"></footer>
    </div>
  );
}
