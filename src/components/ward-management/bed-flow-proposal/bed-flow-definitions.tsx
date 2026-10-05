import styles from "./bed-flow-proposal.module.css";

/** How the Capacity and Network proposal counts its figures, in the same words on both screens. */
export function BedFlowDefinitions() {
  return (
    <dl className={styles.definitions} aria-label="How these figures are counted">
      <div>
        <dt>Ready</dt>
        <dd>Empty and offered by the ward now. Locked ready beds are part of this figure.</dd>
      </div>
      <div>
        <dt>Pulled</dt>
        <dd>A bed given to someone who has not arrived yet. Not counted as occupied.</dd>
      </div>
      <div>
        <dt>Occupancy</dt>
        <dd>Occupied beds ÷ all beds. People on leave keep their bed and count as occupied.</dd>
      </div>
      <div>
        <dt>On ED lists</dt>
        <dd>Every open journey from an emergency department, whatever its stage.</dd>
      </div>
      <div>
        <dt>Still need a bed</dt>
        <dd>Open journeys at placement requested, destination review or accepted. No bed is held for them yet.</dd>
      </div>
      <div>
        <dt>Free by midnight</dt>
        <dd>
          Confirmed and expected discharges due today. Discharges dated on an earlier day are counted apart, as past
          date.
        </dd>
      </div>
    </dl>
  );
}
