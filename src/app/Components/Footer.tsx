import React from "react";

export default function Footer() {
  return (
    <footer
      className="w-full bg-[#18181b] text-[var(--off-white)] py-6 mt-12 border-t border-[var(--orange)] shadow-lg"
    >
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 px-6">
        <div className="text-lg font-bold tracking-wide">
          CodeConnect
        </div>
        <div className="text-sm text-gray-400">
          Contact:{" "}
          <a
            href="mailto:contact@codeconnect.dev"
            className="text-[var(--orange)] hover:underline transition"
          >
            kenji.k.berry@gmail.com
          </a>
        </div>
        <div className="text-sm text-gray-500">
          Developed by <span className="text-[var(--title-red)] font-semibold"><a href="https://www.linkedin.com/in/kenji-berry/" target="_blank">Kenji</a></span>
        </div>
      </div>
    </footer>
  );
}