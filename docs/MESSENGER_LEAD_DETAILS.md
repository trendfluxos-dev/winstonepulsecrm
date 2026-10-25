# Messenger linked-lead sidebar

The selected conversation now has a read-only linked-lead panel (beside messages on wide screens, below on smaller screens). It displays saved name, phone, address, source, lead status, temperature, grade and the stored inbound message timestamp in Dhaka time.

The lookup key is a genuinely stored inbound message UUID, never a name, phone, demo ID or client-supplied lead ID. The server resolves that message's reviewed lead_id. Agents must own both the Messenger thread and the currently assigned CRM lead; HQ/IT retains read-only detail access. Unlinked, missing and inaccessible states disclose no customer information.

Connection enablement is unchanged. The Messenger service currently remains fail-closed and the existing inbox supplies only demo threads, so the panel shows an inactive notice and performs no customer lookup. The panel is prepared for future stored-message inbox wiring through `storedMessageId`; it does not itself enable Meta, implement live message loading, create leads or send replies. Live verification awaits approved connection activation and genuine stored-message selection.

Inventory source activation is separate. The owner chose an existing sheet but has not supplied its URL/tab. No Daily Lead Report sheet is substituted, no new sheet is created, and no schedule is activated until the real source and callback are verified.