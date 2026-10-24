import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { Seat } from '../src/api';
import { SeatGrid } from '../src/room/SeatGrid';

const LAYOUTS: Record<number, number[]> = { 8: [4, 4], 10: [5, 5], 12: [4, 4, 4], 16: [4, 4, 4, 4], 20: [5, 5, 5, 5] };

const seatsFor = (n: number): Seat[] =>
  Array.from({ length: n }, (_, i) => ({
    seatIndex: i,
    rowIndex: 0,
    columnIndex: 0,
    role: i === 0 ? 'HOST' : 'SPEAKER',
    streamId: null,
    micMuted: false,
    modMuted: false,
    locked: i === 2,
    occupant: i === 0 ? { userId: 'host', displayName: 'Host', avatarUrl: null, presence: 'CONNECTED' } : null,
  }));

test.each(Object.entries(LAYOUTS))('%s seats render rows %j', (n, rows) => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(
      <SeatGrid rowLayout={rows} seats={seatsFor(Number(n))} meId="me" hostUserId="host" admins={[]} levels={{}} pendingSeat={null} onPress={() => {}} />,
    );
  });
  const tiles = r.root.findAll((x) => typeof x.type === 'string' && x.props.accessibilityRole === 'button');
  const perRow = rows.map(
    (_, i) =>
      r.root
        .find((x) => typeof x.type === 'string' && x.props.testID === `seat-row-${i}`)
        .findAll((x) => typeof x.type === 'string' && x.props.accessibilityRole === 'button').length,
  );
  expect(perRow).toEqual(rows);
  expect(tiles).toHaveLength(Number(n));
  expect(tiles[0].props.accessibilityLabel).toBe('Owner Host');
  expect(tiles[1].props.accessibilityLabel).toBe('Empty seat 2');
  expect(tiles[2].props.accessibilityLabel).toBe('Locked seat 3');
});
