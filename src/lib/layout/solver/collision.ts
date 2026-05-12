/**
 * Collision detection for the layout solver.
 *
 * Provides functions to find blocks that collide with a given block
 * and to check if a layout has any collisions.
 */

import { intersects } from "./geometry";
import type { LayoutBlock } from "./types";

/**
 * Find all blocks that collide with the given block.
 * Does not include the block itself in the results.
 *
 * @param block The block to check collisions for
 * @param others All other blocks in the layout
 * @returns Array of blocks that intersect with the given block
 */
export function findCollisions(
  block: LayoutBlock,
  others: LayoutBlock[]
): LayoutBlock[] {
  return others.filter(
    (other) => other.id !== block.id && intersects(block.position, other.position)
  );
}

/**
 * Find all blocks that collide with the given position.
 *
 * @param position The position to check
 * @param blocks All blocks in the layout
 * @param excludeId Optional block ID to exclude from results
 * @returns Array of blocks that intersect with the position
 */
export function findCollisionsAtPosition(
  position: LayoutBlock["position"],
  blocks: LayoutBlock[],
  excludeId?: string
): LayoutBlock[] {
  return blocks.filter(
    (block) =>
      block.id !== excludeId && intersects(position, block.position)
  );
}

/**
 * Check if a block has any collisions with other blocks.
 */
export function hasCollision(
  block: LayoutBlock,
  others: LayoutBlock[]
): boolean {
  return others.some(
    (other) => other.id !== block.id && intersects(block.position, other.position)
  );
}

/**
 * Check if a layout has any collisions between blocks.
 * Uses O(n²) pairwise comparison.
 *
 * @param blocks All blocks in the layout
 * @returns true if any two blocks overlap
 */
export function hasAnyCollision(blocks: LayoutBlock[]): boolean {
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (intersects(blocks[i].position, blocks[j].position)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Find all pairs of colliding blocks.
 * Returns array of [blockA, blockB] pairs.
 */
export function findAllCollisions(
  blocks: LayoutBlock[]
): [LayoutBlock, LayoutBlock][] {
  const collisions: [LayoutBlock, LayoutBlock][] = [];

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (intersects(blocks[i].position, blocks[j].position)) {
        collisions.push([blocks[i], blocks[j]]);
      }
    }
  }

  return collisions;
}

/**
 * Get all blocks except the one with the given ID.
 * Useful for getting "others" for collision detection.
 */
export function excludeBlock(
  blocks: LayoutBlock[],
  blockId: string
): LayoutBlock[] {
  return blocks.filter((b) => b.id !== blockId);
}

/**
 * Get a block by ID from an array.
 * Returns undefined if not found.
 */
export function getBlockById(
  blocks: LayoutBlock[],
  blockId: string
): LayoutBlock | undefined {
  return blocks.find((b) => b.id === blockId);
}

/**
 * Replace a block in an array by ID.
 * Returns a new array with the block replaced.
 * If the block is not found, returns a copy with the new block appended.
 */
export function replaceBlock(
  blocks: LayoutBlock[],
  newBlock: LayoutBlock
): LayoutBlock[] {
  const index = blocks.findIndex((b) => b.id === newBlock.id);

  if (index === -1) {
    return [...blocks, newBlock];
  }

  const result = [...blocks];
  result[index] = newBlock;
  return result;
}

/**
 * Replace multiple blocks in an array.
 * Returns a new array with the blocks replaced.
 */
export function replaceBlocks(
  blocks: LayoutBlock[],
  newBlocks: LayoutBlock[]
): LayoutBlock[] {
  const newBlocksMap = new Map(newBlocks.map((b) => [b.id, b]));

  return blocks.map((block) => newBlocksMap.get(block.id) ?? block);
}
