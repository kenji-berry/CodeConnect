import CodeConnectTitle from "./Components/CodeConnectTitle";
import Logo from "./Components/Logo";

export default function Home() {
  return (
    <div className="w-screen h-screen radial-background flex justify-center">
      <Logo rem={7} />
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center"></footer>
    </div>
  );
}
