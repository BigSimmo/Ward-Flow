import WardFlowLoading from "../loading";

/**
 * H-0182: the TV hides the app's top bar and side menu (DA-23). While this route loaded, the shared
 * placeholder showed them, and the whole page jumped up when the TV arrived. The marker below lets
 * the layout hide them from the first paint; the placeholder itself is the shared one.
 */
export default function BedMeetingTvLoading() {
  return (
    <>
      <div hidden data-wf-tv-clean="" />
      <WardFlowLoading />
    </>
  );
}
