function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16); // 转成无符号 16 进制
}

// 获取对象的稳定哈希
export function getObjectHash(obj) {
  // 规范化：按 key 排序后序列化，保证相同内容得到相同哈希
  const sortedStr = JSON.stringify(obj, Object.keys(obj).sort());
  return hashString(sortedStr);
}
