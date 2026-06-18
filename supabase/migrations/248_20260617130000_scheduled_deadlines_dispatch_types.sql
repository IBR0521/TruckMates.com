-- Extend scheduled_deadlines entity types for dispatch event timers.

ALTER TABLE public.scheduled_deadlines
  DROP CONSTRAINT IF EXISTS scheduled_deadlines_entity_type_check;

ALTER TABLE public.scheduled_deadlines
  ADD CONSTRAINT scheduled_deadlines_entity_type_check CHECK (
    entity_type IN (
      'driver_hos',
      'load_detention',
      'load_delivery',
      'check_call_missed',
      'driver_late',
      'emergency_escalation'
    )
  );
