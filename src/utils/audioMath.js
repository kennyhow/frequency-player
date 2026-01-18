// Maps a linear slider value (0-100) to a logarithmic frequency (min-max)
export function toLog(position, min, max) {
    const minv = Math.log(min);
    const maxv = Math.log(max);
    const scale = (maxv - minv) / 100;
    return Math.exp(minv + scale * position);
}

// Maps a logarithmic frequency (min-max) to a linear slider position (0-100)
export function toLinear(value, min, max) {
    const minv = Math.log(min);
    const maxv = Math.log(max);
    const scale = (maxv - minv) / 100;
    return (Math.log(value) - minv) / scale;
}
