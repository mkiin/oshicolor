import { useAtomValue, useSetAtom } from "jotai";
import { startTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { colorSpaceAtom } from "../color-extractor.atoms";

export const ColorSpaceSwitch: React.FC = () => {
  const current = useAtomValue(colorSpaceAtom);
  const setColorSpace = useSetAtom(colorSpaceAtom);

  const isOklch = current === "oklch";

  const handleChange = (checked: boolean) => {
    startTransition(() => {
      setColorSpace(checked ? "oklch" : "rgb");
    });
  };

  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <span className="text-xs text-gray-400">RGB</span>
      <Switch checked={isOklch} onCheckedChange={handleChange} size="sm" />
      <span className="text-xs text-gray-400">OKLCh</span>
    </label>
  );
};
