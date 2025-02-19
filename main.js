var client = ZAFClient.init();

async function handleTicketSave() {
    try {
        
        const ticketData = await client.get([
            "ticket.comment.text",
            "ticket.status",
            "ticket.id",
            "ticket.customStatus.id",
            "ticket.customStatus.name",
            "ticket.customField:custom_field_32634769968017",  // ID for "Reason for Pending"
            "ticket.customField:custom_field_32634668439057",  // ID for "Reason for On-hold"
            "ticket.customField:custom_field_32634717715985",  // ID for "Reason for SendBack"
            "ticket.customField:custom_field_32634727836049",  // ID for Reassigned
            "ticket.customField:custom_field_32634747020561",  // ID for Assigned to whom?
            "ticket.created_at"
        ]);

        const ticketId = ticketData["ticket.id"];
        const comment = ticketData["ticket.comment.text"]?.trim();
        const status = ticketData["ticket.status"];
        const customStatusId = String(ticketData["ticket.customStatus.id"]); // Convert to string
        const customStatusName = ticketData["ticket.customStatus.name"]?.trim(); // Ensure we fetch the latest name
        const pendingReason = ticketData["ticket.customField:custom_field_32634769968017"]?.trim();
        const onHoldReason = ticketData["ticket.customField:custom_field_32634668439057"]?.trim();
        const sendbackReason = ticketData["ticket.customField:custom_field_32634717715985"]?.trim();
        const ReassignedReason = ticketData["ticket.customField:custom_field_32634727836049"]?.trim();
        const AssignedtoWhom = ticketData["ticket.customField:custom_field_32634747020561"]?.trim();

        console.log("Fetched Ticket Status:", status);
        console.log("Fetched Custom Status ID:", customStatusId);
        console.log("Fetched Custom Status Name:", customStatusName);
        console.log("Pending Reason:", pendingReason);
        console.log("On-hold Reason:", onHoldReason);
        console.log("SendBack Reason:", sendbackReason);


        

        // 1️⃣ Check if a comment is required
        if (!comment) {
            await client.invoke('instances.create', {
                location: 'modal',
                url: 'assets/comment_required_modal.html',
                size: { width: '500px', height: '340px' }
            });
            return Promise.reject("A comment is required before updating the ticket.");
        }


        // 2️⃣ Handle "Pending" status category and subcategories
        if (status === "pending") {
            if (customStatusId && customStatusName === "Sent Back") {  
                // Get ticket creation time

                const ticketCreatedAtRaw = await getTicketCreatedAt(ticketId);
                if (!ticketCreatedAtRaw) {
                    console.error("Failed to fetch ticket.created_at");
                    return Promise.reject("Unable to verify ticket creation time.");
                }
                console.log(" created at " , ticketCreatedAtRaw);
                const ticketCreatedAt = new Date(ticketCreatedAtRaw).getTime();
                const currentTime = new Date().getTime();
                const timeDifference = currentTime - ticketCreatedAt;
                const thirtyMinutesInMillis = 30 * 60 * 1000;
        
                console.log(timeDifference, "  >  ", thirtyMinutesInMillis);
        
                // 1️⃣ First, block "Sent Back" if 30 minutes have passed
                if (timeDifference > thirtyMinutesInMillis) {
                    await client.invoke('instances.create', {
                        location: 'modal',
                        url: 'assets/sent_back_time_limit_exceeded_modal.html',
                        size: { width: '500px', height: '240px' }
                    });
                    return Promise.reject("You can't set the status to 'Sent Back' because 30 minutes have passed since the ticket creation.");
                }
        
                // 2️⃣ If within 30 minutes, ensure the "Reason for SendBack" is provided
                if (!sendbackReason) {
                    await client.invoke('instances.create', {
                        location: 'modal',
                        url: 'assets/sendback_reason_required_modal.html',
                        size: { width: '500px', height: '340px' }
                    });
                    return Promise.reject("You must provide a Reason for SendBack before setting the status.");
                }
            } 
            else {  // If no custom status (regular Pending)
                if (!pendingReason) {
                    await client.invoke('instances.create', {
                        location: 'modal',
                        url: 'assets/pending_reason_required_modal.html',
                        size: { width: '500px', height: '340px' }
                    });
                    return Promise.reject("You must provide a Reason for Pending before setting the status.");
                }
            }
        }
        

        if (status === "open") {
            if (customStatusId && customStatusName === "Reassigned") {  // If a custom status exists (e.g., "Sendback")
                if (!ReassignedReason || !AssignedtoWhom) {
                    await client.invoke('instances.create', {
                        location: 'modal',
                        url: 'assets/reassigned_reason_required_modal.html',
                        size: { width: '500px', height: '340px' }
                    });
                    return Promise.reject("You must provide a Reason for SendBack before setting the status.");
                }
            }
        }


        // 3️⃣ Check if "Reason for On-hold" is filled when setting the status to "hold"
        if (status === "hold" && !onHoldReason) {
            await client.invoke('instances.create', {
                location: 'modal',
                url: 'assets/onhold_reason_required_modal.html',
                size: { width: '500px', height: '340px' }
            });
            return Promise.reject("You must provide a Reason for On-hold before setting the status.");
        }

        return Promise.resolve(); // Allow ticket save if all checks pass
    } catch (error) {
        console.error("Error in ticket save enforcement: ", error);
        return Promise.resolve(); // Fail-safe to prevent accidental blocking
    }
}

// Enforce all rules on ticket save
client.on("ticket.save", handleTicketSave);

async function getTicketCreatedAt(ticketId) {
    try {
        const response = await client.request({
            url: `/api/v2/tickets/${ticketId}.json`,
            type: "GET",
            contentType: "application/json"
        });

        return response.ticket.created_at; // Return the created_at timestamp
    } catch (error) {
        console.error("Error fetching ticket created_at:", error);
        return null;
    }
}








