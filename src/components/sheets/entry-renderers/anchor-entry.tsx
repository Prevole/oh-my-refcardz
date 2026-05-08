import { registerHandler } from "./entry-registry";

type Props = {
  value: string;
};

export function AnchorEntry({ value }: Props) {
  void value;
  return null;
}

registerHandler("anchor", (value) => <AnchorEntry value={value} />);
