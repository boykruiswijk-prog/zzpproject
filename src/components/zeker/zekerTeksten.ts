export type ZekerTaal = "nl" | "en" | "de" | "fr";

export const ZEKER_TEKSTEN: Record<ZekerTaal, {
  titel: string; subtitel: string; welkom: string; suggesties: string[]; disclaimer: string; disclaimerLink: string;
  placeholder: string; versturen: string; sluiten: string; nieuw: string; typen: string; nuttig: string; nietNuttig: string;
  acties: Record<"terugbelformulier" | "afsluiten" | "offerte" | "bellen" | "whatsapp", string>;
  form: { titel: string; naam: string; telefoon: string; email: string; moment: string; vraag: string; toestemming: string; versturen: string; annuleren: string; bevestiging: string; fout: string; momenten: string[] };
  fout: string;
}> = {
  nl: {
    titel: "Zeker", subtitel: "Digitale assistent van ZP Zaken",
    welkom: "Hoi! Ik ben Zeker, de digitale assistent van ZP Zaken. Ik help je graag met vragen over onze verzekeringen, de aanvraag of je polis. Waarmee kan ik je helpen?",
    suggesties: ["Wat kost de BAV + AVB?", "Wat dekt de verzekering?", "Hoe sluit ik direct af?", "Ik wil teruggebeld worden"],
    disclaimer: "Je chat met een digitale assistent. Antwoorden zijn algemene informatie, geen persoonlijk advies.", disclaimerLink: "Lees hoe we met je gegevens omgaan.",
    placeholder: "Typ je vraag…", versturen: "Versturen", sluiten: "Chat sluiten", nieuw: "Nieuw gesprek", typen: "Zeker typt…", nuttig: "Nuttig antwoord", nietNuttig: "Niet nuttig",
    acties: { terugbelformulier: "Terugbelverzoek", afsluiten: "Direct afsluiten", offerte: "Offerte aanvragen", bellen: "Bel 020 - 457 3077", whatsapp: "WhatsApp" },
    form: { titel: "Laat je terugbellen", naam: "Naam", telefoon: "Telefoonnummer", email: "E-mail (optioneel)", moment: "Voorkeursmoment", vraag: "Korte vraag", toestemming: "Ik geef ZP Zaken toestemming om contact met mij op te nemen over deze vraag.", versturen: "Verstuur verzoek", annuleren: "Annuleren", bevestiging: "Bedankt! We hebben je terugbelverzoek ontvangen. Een collega belt je zo snel mogelijk, uiterlijk binnen één werkdag.", fout: "Versturen lukte niet. Bel ons gerust op 020 - 457 3077.", momenten: ["Zo snel mogelijk", "Ochtend", "Middag", "Einde van de dag"] },
    fout: "Sorry, dat lukt me nu even niet. Bel ons gerust op 020 - 457 3077 of stuur een WhatsApp.",
  },
  en: {
    titel: "Zeker", subtitel: "Digital assistant of ZP Zaken",
    welkom: "Hi! I'm Zeker, the digital assistant of ZP Zaken. I'm happy to help with questions about our insurance, applying or your policy. How can I help you?",
    suggesties: ["What does BAV + AVB cost?", "What does the insurance cover?", "How do I apply directly?", "I'd like a call back"],
    disclaimer: "You are chatting with a digital assistant. Answers are general information, not personal advice.", disclaimerLink: "Read how we handle your data.",
    placeholder: "Type your question…", versturen: "Send", sluiten: "Close chat", nieuw: "New conversation", typen: "Zeker is typing…", nuttig: "Helpful", nietNuttig: "Not helpful",
    acties: { terugbelformulier: "Request a call back", afsluiten: "Apply directly", offerte: "Request a quote", bellen: "Call +31 20 457 3077", whatsapp: "WhatsApp" },
    form: { titel: "Request a call back", naam: "Name", telefoon: "Phone number", email: "Email (optional)", moment: "Preferred time", vraag: "Short question", toestemming: "I give ZP Zaken permission to contact me about this question.", versturen: "Send request", annuleren: "Cancel", bevestiging: "Thank you! We received your call back request. A colleague will call you as soon as possible, within one working day.", fout: "Sending failed. Please call us on +31 20 457 3077.", momenten: ["As soon as possible", "Morning", "Afternoon", "End of day"] },
    fout: "Sorry, I can't help right now. Please call us on +31 20 457 3077 or send a WhatsApp.",
  },
  de: {
    titel: "Zeker", subtitel: "Digitaler Assistent von ZP Zaken",
    welkom: "Hallo! Ich bin Zeker, der digitale Assistent von ZP Zaken. Ich helfe gern bei Fragen zu unseren Versicherungen, zum Antrag oder zu deiner Police. Wie kann ich helfen?",
    suggesties: ["Was kostet BAV + AVB?", "Was deckt die Versicherung?", "Wie schließe ich direkt ab?", "Ich möchte zurückgerufen werden"],
    disclaimer: "Du chattest mit einem digitalen Assistenten. Antworten sind allgemeine Informationen, keine persönliche Beratung.", disclaimerLink: "So gehen wir mit deinen Daten um.",
    placeholder: "Deine Frage…", versturen: "Senden", sluiten: "Chat schließen", nieuw: "Neues Gespräch", typen: "Zeker schreibt…", nuttig: "Hilfreich", nietNuttig: "Nicht hilfreich",
    acties: { terugbelformulier: "Rückruf anfordern", afsluiten: "Direkt abschließen", offerte: "Angebot anfordern", bellen: "Anrufen +31 20 457 3077", whatsapp: "WhatsApp" },
    form: { titel: "Rückruf anfordern", naam: "Name", telefoon: "Telefonnummer", email: "E-Mail (optional)", moment: "Bevorzugte Zeit", vraag: "Kurze Frage", toestemming: "Ich erlaube ZP Zaken, mich zu dieser Frage zu kontaktieren.", versturen: "Anfrage senden", annuleren: "Abbrechen", bevestiging: "Danke! Wir haben deine Rückrufanfrage erhalten. Ein Kollege ruft dich so bald wie möglich an, spätestens innerhalb eines Werktags.", fout: "Senden fehlgeschlagen. Ruf uns gern an: +31 20 457 3077.", momenten: ["So bald wie möglich", "Vormittag", "Nachmittag", "Ende des Tages"] },
    fout: "Entschuldigung, das klappt gerade nicht. Ruf uns gern an unter +31 20 457 3077 oder schreib per WhatsApp.",
  },
  fr: {
    titel: "Zeker", subtitel: "Assistant numérique de ZP Zaken",
    welkom: "Bonjour ! Je suis Zeker, l'assistant numérique de ZP Zaken. Je réponds volontiers à tes questions sur nos assurances, la demande ou ta police. Comment puis-je t'aider ?",
    suggesties: ["Combien coûte la BAV + AVB ?", "Que couvre l'assurance ?", "Comment souscrire directement ?", "Je souhaite être rappelé"],
    disclaimer: "Tu discutes avec un assistant numérique. Les réponses sont des informations générales, pas un conseil personnel.", disclaimerLink: "Comment nous traitons tes données.",
    placeholder: "Ta question…", versturen: "Envoyer", sluiten: "Fermer le chat", nieuw: "Nouvelle conversation", typen: "Zeker écrit…", nuttig: "Utile", nietNuttig: "Pas utile",
    acties: { terugbelformulier: "Être rappelé", afsluiten: "Souscrire directement", offerte: "Demander un devis", bellen: "Appeler +31 20 457 3077", whatsapp: "WhatsApp" },
    form: { titel: "Être rappelé", naam: "Nom", telefoon: "Téléphone", email: "E-mail (facultatif)", moment: "Moment préféré", vraag: "Question courte", toestemming: "J'autorise ZP Zaken à me contacter au sujet de cette question.", versturen: "Envoyer", annuleren: "Annuler", bevestiging: "Merci ! Nous avons bien reçu ta demande de rappel. Un collègue t'appellera dès que possible, au plus tard sous un jour ouvré.", fout: "L'envoi a échoué. Appelle-nous au +31 20 457 3077.", momenten: ["Dès que possible", "Matin", "Après-midi", "Fin de journée"] },
    fout: "Désolé, je ne peux pas aider pour le moment. Appelle-nous au +31 20 457 3077 ou envoie un WhatsApp.",
  },
};
