import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function stroke(props: IconProps) {
  const { size = 24, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export function CompassRose({ size = 40, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...rest}>
      <circle
        cx="24"
        cy="24"
        r="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M24 3 L28 24 L24 45 L20 24 Z" fill="currentColor" />
      <path
        d="M3 24 L24 20 L45 24 L24 28 Z"
        fill="currentColor"
        opacity=".55"
      />
      <path
        d="M9 9 L24 24 L39 39 M39 9 L24 24 L9 39"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity=".4"
        fill="none"
      />
      <circle cx="24" cy="24" r="3" fill="currentColor" />
    </svg>
  );
}

export function WaxSeal({ size = 12, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M12 5l2 7-2 6-2-6z" fill="currentColor" />
    </svg>
  );
}

export function IconCart(props: IconProps) {
  return (
    <svg {...stroke(props)}>
      <path d="M6 6h15l-1.5 9h-12z" />
      <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <path d="M6 6L4.5 3H2" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...stroke(props)}>
      <path d="M18 9a6 6 0 10-12 0c0 6-2 8-2 8h16s-2-2-2-8z" />
      <path d="M10.5 20a2 2 0 003 0" />
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <svg {...stroke(props)}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function IconBarter(props: IconProps) {
  return (
    <svg {...stroke(props)}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  );
}

export function IconScale(props: IconProps) {
  return (
    <svg {...stroke(props)}>
      <path d="M12 4v16M6 20h12M5 8h14" />
      <path d="M5 8l-2 5a4 4 0 008 0z" />
      <path d="M19 8l2 5a4 4 0 01-8 0z" />
    </svg>
  );
}

export function IconShop(props: IconProps) {
  return (
    <svg {...stroke(props)}>
      <path d="M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16" />
    </svg>
  );
}

export function IconNews(props: IconProps) {
  return (
    <svg {...stroke(props)}>
      <path d="M5 4h11a2 2 0 012 2v14H7a2 2 0 01-2-2z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}
