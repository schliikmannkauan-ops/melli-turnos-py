import logoAsset from "@/assets/barberia-melli-logo.png.asset.json";

export function BrandLogo({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Barbería Melli"
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
