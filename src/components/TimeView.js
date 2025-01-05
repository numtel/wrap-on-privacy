export default function TimeView({ timestamp }) {
  return remaining(Math.round(Date.now() / 1000) - timestamp.toString(), true, timestamp);
}

export function remaining(seconds, onlyFirst, timestamp) {
  const units = [
    { value: 1, unit: 'second' },
    { value: 60, unit: 'minute' },
    { value: 60 * 60, unit: 'hour' },
    { value: 60 * 60 * 24, unit: 'day' },
    // Relative dates are not useful past a certain point, 10 days ago max
    { value: 60 * 60 * 24 * 11, unit: null },
  ];
  let remaining = Number(seconds);
  let out = [];
  for(let i = units.length - 1; i >= 0;  i--) {
    if(remaining >= units[i].value) {
      if(units[i].unit === null)
        return (new Date(Number(timestamp * 1000n))).toLocaleString();
      const count = Math.floor(remaining / units[i].value);
      out.push(count.toString(10) + ' ' + units[i].unit + (count !== 1 ? 's' : ''));
      if(onlyFirst) break;
      remaining = remaining - (count * units[i].value);
    }
  }
  return out.join(', ') + ' ago';
}
