import React from 'react';
import { parseWaFormatting } from '../lib/waFormat';

/** Message text drawn the way WhatsApp draws it: *bold*, _italic_, ~strike~ and ```monospace``` without their marks. */
export const WaText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {parseWaFormatting(text).map((s, i) => {
      let node: React.ReactNode = s.text;
      if (s.mono) node = <code className="wa-inline-code">{node}</code>;
      if (s.strike) node = <del>{node}</del>;
      if (s.italic) node = <em>{node}</em>;
      if (s.bold) node = <strong>{node}</strong>;
      return <React.Fragment key={i}>{node}</React.Fragment>;
    })}
  </>
);
