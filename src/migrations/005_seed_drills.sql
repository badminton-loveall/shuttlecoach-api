-- Seed data: 20 drills from DrillLibrary component
-- Version: 005

INSERT INTO drills (id, name, description, category, is_archived) VALUES
  ('drill-001', 'Grip Practice', 'Practice correct grip technique for forehand and backhand strokes', 'Fundamentals', false),
  ('drill-002', 'Court Movement Patterns', 'Basic footwork patterns covering all six court positions', 'Footwork', false),
  ('drill-003', 'Shadow Practice', 'Movement without shuttle focusing on footwork and body positioning', 'Footwork', false),
  ('drill-004', 'High Clear Practice', 'Repetitive forehand clear shots to baseline with focus on technique', 'Stroke Practice', false),
  ('drill-005', 'Drop Shot Accuracy', 'Forehand drop shots targeting net area with controlled power', 'Stroke Practice', false),
  ('drill-006', 'Clear to Drop Combination', 'Alternating between clear and drop shots to develop versatility', 'Combination Drills', false),
  ('drill-007', 'Backhand Clear Drills', 'Developing power and accuracy in backhand overhead clear', 'Stroke Practice', false),
  ('drill-008', 'Net Shot Practice', 'Forehand and backhand net shots with soft touch and precision', 'Net Play', false),
  ('drill-009', 'Net Rush Drills', 'Quick movement to net and recovery with proper technique', 'Footwork', false),
  ('drill-010', 'High Service Practice', 'Consistent high service to backcourt with proper form', 'Service', false),
  ('drill-011', 'Low Service Precision', 'Short service landing just over net with minimal height', 'Service', false),
  ('drill-012', 'Return Positioning', 'Proper stance and return technique for various service types', 'Return', false),
  ('drill-013', 'Smash Power Development', 'Building explosive power in smash with proper body rotation', 'Stroke Practice', false),
  ('drill-014', 'Defensive Lift Practice', 'Returning smashes with controlled lifts to backcourt', 'Defense', false),
  ('drill-015', 'Block and Counter', 'Blocking smashes and transitioning to counter-attack', 'Defense', false),
  ('drill-016', 'Sustained Rally Practice', 'Maintaining rallies with focus on consistency and placement', 'Rally', false),
  ('drill-017', 'Shot Variation Drills', 'Mixing clears, drops, and drives to develop unpredictability', 'Combination Drills', false),
  ('drill-018', 'Tempo Change Practice', 'Controlling rally speed from slow build-up to fast exchanges', 'Rally', false),
  ('drill-019', 'Controlled Match Play', 'Practice matches with specific tactical objectives', 'Match Practice', false),
  ('drill-020', 'Pressure Situations', 'Playing critical points with emphasis on mental composure', 'Match Practice', false)
ON CONFLICT (id) DO NOTHING;
