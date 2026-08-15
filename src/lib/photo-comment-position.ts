// 这个模块把旋转后屏幕上的点击坐标还原为原图归一化坐标。

type PhotoRatio = {
  xRatio: number;
  yRatio: number;
}

function screenPointToPhotoRatio(screenX: number, screenY: number, rotate: number): PhotoRatio {
  const x = Math.min(1, Math.max(0, screenX));
  const y = Math.min(1, Math.max(0, screenY));
  const normalizedRotate = ((rotate % 360) + 360) % 360;

  if (normalizedRotate === 90) {
    return { xRatio: y, yRatio: 1 - x };
  }

  if (normalizedRotate === 180) {
    return { xRatio: 1 - x, yRatio: 1 - y };
  }

  if (normalizedRotate === 270) {
    return { xRatio: 1 - y, yRatio: x };
  }

  return { xRatio: x, yRatio: y };
}

export { screenPointToPhotoRatio };
export type { PhotoRatio };
