import type { ExtractConfig, Palette } from "../../types/colors";

import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Slider } from "@/shared/components/ui/slider";
import { Switch } from "@/shared/components/ui/switch";
import { RotateCcwIcon } from "lucide-react";

type ExtractOptionsProps = {
  config: ExtractConfig;
  onChange: (config: ExtractConfig) => void;
};

const PALETTE_OPTIONS: {
  value: Palette;
  label: string;
  description: string;
}[] = [
  {
    value: "salience",
    label: "Salience",
    description: "目立つ色を選ぶ既定の方式",
  },
  { value: "ansi", label: "ANSI", description: "端末の 16 色配列に並べる" },
  {
    value: "kmeans",
    label: "K-means",
    description: "Lab 空間でクラスタリング",
  },
];

const DEFAULT_THRESHOLD = 14;
const DEFAULT_SATURATION = 50;
const DEFAULT_K = 16;
const DEFAULT_MIN_DIST = 10;

const single = (value: number | number[]): number =>
  Array.isArray(value) ? value[0] : value;

const Row: React.FC<{
  children: React.ReactNode;
  label: string;
  hint?: string;
}> = ({ children, label, hint }) => (
  <div className="flex items-center justify-between gap-4 py-1">
    <div className="flex flex-col">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
    {children}
  </div>
);

const SliderField: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display?: string;
  onValueChange: (value: number) => void;
}> = ({ label, value, min, max, step, display, onValueChange }) => (
  <div className="bg-muted/40 mt-1 flex flex-col gap-2 rounded-md p-3">
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{display ?? value}</span>
    </div>
    <Slider
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={(next) => onValueChange(single(next))}
    />
  </div>
);

export const ExtractOptions: React.FC<ExtractOptionsProps> = ({
  config,
  onChange,
}) => {
  const set = (patch: Partial<ExtractConfig>) =>
    onChange({ ...config, ...patch });

  const isDynamic = config.dynamic ?? true;
  const isLight = config.style === "light";
  const hasSaturation = config.saturation !== undefined;
  const isSalience = config.palette === "salience";
  const isKmeans = config.palette === "kmeans";

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <Label className="text-muted-foreground text-xs tracking-wide uppercase">
          抽出方式
        </Label>
        <RadioGroup
          value={config.palette}
          onValueChange={(value) => set({ palette: value as Palette })}
        >
          {PALETTE_OPTIONS.map((option) => (
            <Label
              key={option.value}
              className="border-border has-[[data-checked]]:border-primary has-[[data-checked]]:bg-accent flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors"
            >
              <RadioGroupItem value={option.value} className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-muted-foreground text-xs">
                  {option.description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </section>

      <section className="flex flex-col gap-1">
        <Label className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
          調整
        </Label>

        <Row label="テーマ" hint={isLight ? "light" : "dark"}>
          <Switch
            checked={isLight}
            onCheckedChange={(checked) =>
              set({ style: checked ? "light" : "dark" })
            }
          />
        </Row>

        <Row label="16 色化" hint="下半分を暗くして色数を増やす">
          <Switch
            checked={config.use16cols ?? false}
            onCheckedChange={(checked) => set({ use16cols: checked })}
          />
        </Row>

        <Row label="コントラスト補正" hint="WCAG で読みやすさを担保">
          <Switch
            checked={config.checkContrast ?? false}
            onCheckedChange={(checked) => set({ checkContrast: checked })}
          />
        </Row>

        <Row label="彩度の上乗せ" hint="抽出後に色を鮮やかにする">
          <Switch
            checked={hasSaturation}
            onCheckedChange={(checked) =>
              set({ saturation: checked ? DEFAULT_SATURATION : undefined })
            }
          />
        </Row>

        {hasSaturation && (
          <SliderField
            label="彩度"
            min={1}
            max={100}
            value={config.saturation ?? DEFAULT_SATURATION}
            display={`${config.saturation}%`}
            onValueChange={(value) => set({ saturation: value })}
          />
        )}
      </section>

      {isSalience && (
        <section className="flex flex-col gap-1">
          <Label className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
            Salience
          </Label>
          <Row label="しきい値の自動探索" hint="最適なしきい値を自動で選ぶ">
            <Switch
              checked={isDynamic}
              onCheckedChange={(checked) => set({ dynamic: checked })}
            />
          </Row>
          {!isDynamic && (
            <SliderField
              label="しきい値"
              min={1}
              max={100}
              value={config.threshold ?? DEFAULT_THRESHOLD}
              onValueChange={(value) => set({ threshold: value })}
            />
          )}
        </section>
      )}

      {isKmeans && (
        <section className="flex flex-col gap-1">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-muted-foreground text-xs tracking-wide uppercase">
              K-means
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set({ k: DEFAULT_K, minDist: DEFAULT_MIN_DIST })}
              className="text-muted-foreground"
            >
              <RotateCcwIcon />
              既定に戻す
            </Button>
          </div>
          <SliderField
            label="クラスタ数 (k)"
            min={2}
            max={16}
            step={1}
            value={config.k ?? DEFAULT_K}
            onValueChange={(value) => set({ k: value })}
          />
          <SliderField
            label="最小色距離 (ΔE)"
            min={0}
            max={30}
            step={0.5}
            value={config.minDist ?? DEFAULT_MIN_DIST}
            onValueChange={(value) => set({ minDist: value })}
          />
        </section>
      )}
    </div>
  );
};
