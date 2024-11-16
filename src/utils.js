export function removeDuplicates(obj) {
  const uniqueIds = new Set();
  const result = {};

  for (const key in obj) {
    const currentItem = obj[key];

    // Check if the id is already in the uniqueIds set
    if (!uniqueIds.has(currentItem.id)) {
      // If not, add the id to the set and the key-value pair to the result
      uniqueIds.add(currentItem.id);
      result[key] = currentItem;
    }
  }

  return result;
}
