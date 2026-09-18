import Image from "next/image";
import logoLight from "../../public/logo-full-light.png";
import logoDark from "../../public/logo-full-dark.png";

/**
 * The approved "Stacks" logo (mark + wordmark, flattened into one image by Jack in Claude
 * Design) — used identically everywhere the lockup appears: site header, dashboard header,
 * footer, and transactional emails. Renders both a light- and dark-background variant and
 * lets the `dark:` variant (which already tracks the Settings theme override, see
 * globals.css) pick the right one, rather than deriving colors from a live SVG + text pair.
 */
export function FullLogo({ height = 36, className = "" }: { height?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Image src={logoLight} alt="Stacks" height={height} style={{ height, width: "auto" }} className="dark:hidden" />
      <Image src={logoDark} alt="Stacks" height={height} style={{ height, width: "auto" }} className="hidden dark:block" />
    </span>
  );
}
