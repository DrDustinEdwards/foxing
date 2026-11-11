// The prompt a signed-out reader sees on a personal feature (highlight, note,
// bookmark). Its own module so the reader loads Capsomer's Dialog only when the
// prompt first opens (reader-view.tsx lazy-loads it and imports its CSS), not on
// every /read page.
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "capsomer/react/dialog";
import { Link } from "capsomer/react/link";

export default function SignInPrompt({
  loginHref,
  onClose,
}: {
  loginHref: string;
  onClose: () => void;
}) {
  // Capsomer's Dialog: a native modal, so focus stays inside, the reader behind is
  // inert, and Esc, the backdrop and Keep reading close it.
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="sm"
      closeButton={false}
    >
      <DialogHeader>
        <DialogTitle>Sign in to save</DialogTitle>
        <DialogDescription>
          Reading is free. Sign in to keep highlights, notes, bookmarks, and your place.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose part="cancel">Keep reading</DialogClose>
        <Link to={loginHref} className="cap-btn" data-variant="primary">
          Sign in
        </Link>
      </DialogFooter>
    </Dialog>
  );
}
