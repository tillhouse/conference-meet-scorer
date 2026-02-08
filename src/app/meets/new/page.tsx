import { Suspense } from "react";
import NewMeetPageInternal from "./page-internal";

export default function NewMeetPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewMeetPageInternal />
    </Suspense>
  );
}
