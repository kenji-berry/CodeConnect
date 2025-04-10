import React from "react";

const Logo = ({ rem }: { rem: number }) => {
  const size = `${rem}rem`;
  return (
    <div>
      <img
        src="/CodeConnectLogo.svg"
        alt="CodeConnect Logo"
        style={{ width: size, height: size }}
      />
    </div>
  );
};

export default Logo;
