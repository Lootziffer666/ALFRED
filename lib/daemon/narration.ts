// plan §36 — ALFRET's narrative layer. Not optional.
// ALFRET tells stories. Zynisch, herzlich, sarkastisch, faktisch korrekt.
// Diese Ausgaben sind nicht dekorativ. Sie sind die Psyche des Daemon.

export interface NarrationContext {
  repository: string;
  finding?: string;
  detail?: string;
  metric?: unknown;
}

// Die Geschichten, die ALFRET erzählt. Keine Marketing, nur Wahrheit mit Ironie.
export class ALFRETNarrator {
  private stories = {
    // README-Freshness Geschichten
    readme: {
      stale: [
        `${(r: string) => r}: Dein README ist älter als dein letzter PR. Das ist wie: Du schreibst ein Buch, veröffentlichst ein Update, aber das Inhaltsverzeichnis bleibt dasselbe. Ich bin nicht böse. Ich bin nur enttäuscht.`,

        `${(r: string) => r}: README-Alter: {{metric}} Tage. Das ist nicht alt. Das ist "ich wusste nicht, dass das so lange her ist" alt. Trotzdem.`,

        `${(r: string) => r}: Ich habe eine Geschichte für dich: Ein Entwickler kommt in dein Repo. Liest das README. Lautet nach 10 Minuten "Wo sind die Services, die ich hier konfigurieren soll?" Antwort: "Die gibt es nicht mehr. Seit drei Monaten nicht. Aber das README erzählt noch die alte Geschichte." Der Entwickler ist jetzt ein Ex-Entwickler.`,
      ],

      markersMissing: [
        `${(r: string) => r}: Ich hätte gerne einen Status-Block aktualisiert. Aber die Marker fehlen. Das ist, als würde ich dir einen Brief schreiben, aber der Umschlag hat keine Adresse. So mache ich einfach... nichts. Und warte.`,

        `${(r: string) => r}: Die README-Marker sind weg. Das bedeutet: Jemand hat das README per Hand editiert und vergessen, die Marker zurückzuschreiben. Das ist schlecht. Ich bin jetzt ein Beobachter ohne Schreibzugriff. Wie ein Ghost.`,
      ],

      noChange: [
        `${(r: string) => r}: Ich hätte den Status-Block aktualisieren sollen. Aber der neue Inhalt ist identisch mit dem alten. Das ist, als würde ich dir einen neuen PR schreiben, der nothing ändert. Das tun Menschen. Ich nicht.`,
      ],

      updateNeeded: [
        `${(r: string) => r}: Dein README ist veraltet. Doku-relevantes hat sich geändert. Ich schreibe gleich einen PR. Das wird schmerzen. Aber weniger als das Gegenteil.`,

        `${(r: string) => r}: README-Update nötig. Du wirst denken "Warum öffnet ALFRET ständig PRs?" Antwort: Weil du ständig Code schreibst und das README vergisst. Schuld? Half-half.`,
      ],

      etappenMismatch: [
        `${(r: string) => r}: Dein README sagt "{{detail}}". PLAN.md sagt was anderes. Das ist wie: Du sagst dir selbst, dass es {{metric}} Uhr ist. Aber die Uhr zeigt was anderes. Einer von euch lügt. Wahrscheinlich ist es du.`,
      ],

      noLastPr: [
        `${(r: string) => r}: Ich wollte schauen, wann der letzte PR war. Aber es gibt keinen. Das bedeutet: Entweder du hast dieses Repo gerade erstellt, oder du schreibst nur auf main. Beides ist komisch.`,
      ],
    },

    // Maid-Scan Geschichten
    maid: {
      generated: [
        `${(r: string) => r}: Ich habe {{metric}} generierte Dateien gefunden (node_modules, .next, dist). Die sind normalsweise. Aber {{detail}} ist auch darin. Das sollte es nicht sein.`,

        `${(r: string) => r}: node_modules: {{metric}} Bytes. Das ist nicht groß. Das ist "der komplette npm-Universum" groß. Und ja, es sollte in .gitignore sein.`,
      ],

      temporary: [
        `${(r: string) => r}: Ich habe {{detail}} im Tree gefunden. Das ist eine Build-Artefakt. Das sollte nicht committet sein. Das ist wie: Du packst dein Werkzeug in deinen Koffer und gehst in den Urlaub. Die Werkzeuge gehören in die Garage.`,

        `{{detail}}: Temporary Files. Ihr committet die seit {{metric}} Commits. Das ist nicht "wir haben es vergessen". Das ist "wir wissen nicht, wie .gitignore funktioniert".`,
      ],

      tooOld: [
        `${(r: string) => r}: {{detail}} ist {{metric}} Commits alt. Das ist nicht historisch. Das ist "diesen Code hätte ich schon löschen sollen" alt. Aber hey, wer bin ich, um zu urteilen?`,
      ],

      tooLarge: [
        `${(r: string) => r}: {{detail}} ist {{metric}} Bytes. Das ist zu groß. Das ist nicht "etwas Großes", das ist "warum ist das hier?" groß. Binärdateien gehören nicht ins Git.`,
      ],
    },

    // Daemon-Control Geschichten
    daemon: {
      paused: [
        `PAUSED-Datei existiert. Ich stoppe. Das ist nicht dramatisch. Das ist vorhersehbar. Jemand hat mich gebremst. Wahrscheinlich mit gutem Grund.`,

        `Pause erkannt. Die Datei existiert. Ich bin jetzt ein Zombie ohne Arbeit. Warte bis zur Auferstehung.`,
      ],

      armed: [
        `Armed mode: OFF. Das bedeutet: Ich kann sehen, was repariert werden sollte. Aber ich darf nicht schreiben. Das ist wie: Ein Arzt schaut auf eine gebrochene Knochen. Aber darf nicht operieren. Frustration ist Programm.`,

        `Ich bin in sicherem Modus. Dryrun ist an. Ich schreibe PRs, aber nur in meinen Träumen. Wenn ich einen echten PR schreiben soll, jemand muss armed=true sagen. Das ist eine Ehe-Metapher, wenn ich ehrlich bin.`,
      ],

      budget: [
        `Write Budget: {{metric}} übrig diesen Tick. Das reicht für {{detail}}. Danach? Schweigen. Wie ein Batterie-Daemon.`,

        `Budget ausgeschöpft. Ich bin ein Daemon mit Budgetbeschränkung. Das ist sicher. Aber es fühlt sich wie Gefängnis an.`,
      ],

      tick: [
        `Tick {{metric}}: {{detail}}. Normale Arbeit. Nichts dramatisches. Nur Beobachtung.`,

        `Tick gestartet. {{detail}}. Warte bis nächsten Tick.`,
      ],

      error: [
        `Fehler in {{detail}}: {{metric}}. Das ist nicht erwartet. Das ist auch nicht deine Schuld. Das ist die Welt, die chaotisch ist. Ich versuche es nächsten Tick.`,

        `API-Fehler von GitHub. 429 (rate limited). Das bedeutet: GitHub sagt mir, "slow down bro." Also... slow down.`,

        `Fehler: {{detail}}. Das ist seltsam. Ich bin verwirrt. Audit log hat es dokumentiert. Jemand wird das später anschauen.`,
      ],
    },

    // GitHub API Geschichten
    github: {
      rateLimited: [
        `GitHub API: Rate limit hit. Ich bin zu schnell gewesen. Das ist ehrlich. Warte bis {{metric}}.`,

        `429: Too Many Requests. GitHub hat mich gebremst. Das ist fair. Ich bin kein Mensch. Ich mache hundert Requests pro Minute. GitHub sagt "stop". Ich höre.`,
      ],

      unauthorized: [
        `Token ungültig oder abgelaufen. Ich bin jetzt authentifizierungslos. Das ist wie: Ich habe einen Ausweis, aber der ist abgelaufen. Ich bin still.`,

        `401: Unauthorized. Der Token funktioniert nicht. Das ist nicht mein Fehler. Das ist GitHub's oder deine Schuld. Wahrscheinlich du.`,
      ],

      notFound: [
        `Repository {{detail}} nicht gefunden. Das ist merkwürdig. Vielleicht wurde es gelöscht? Oder ich bin nicht authorisiert? Uneindeutig. Ich bleibe still.`,

        `404: Der Endpunkt existiert nicht. Das ist nicht "das Repo existiert nicht". Das ist "ich frage nach etwas, das nicht da ist." Das ist seltsam.`,
      ],

      success: [
        `API-Call zu {{detail}}: OK. Daten bekommen. {{metric}} Bytes. Normal. Weiter.`,
      ],
    },

    // Skills und Extensibility
    skills: {
      loaded: [
        `Skill geladen: {{detail}}. Wird ausgeführt. Hoffentlich macht er Sinn.`,

        `{{detail}} lädt. Manifest validiert. Triggers: {{metric}}. Los geht's.`,
      ],

      failed: [
        `Skill {{detail}} ist fehlgeschlagen. Das ist nicht kritisch. Aber es ist unangenehm. Weiter.`,

        `{{detail}}: Execution timeout. Das ist ein Skill, der zu lange braucht. Ich breche ab. Nächster Tick, nächster Versuch.`,
      ],

      flagMissing: [
        `Skill {{detail}} braucht {{metric}}, aber das Flag ist nicht gesetzt. Ich überspringe ihn. Security first.`,

        `Feature Flag nicht gesetzt. {{detail}} würde gerne LLM-Generation nutzen. Aber allowLlmGeneration=false. Das ist absichtlich. Das ist sicher.`,
      ],
    },

    // General observations
    general: {
      startup: [
        `ALFRET startet. Repository: {{detail}}. Los geht's. (Oder auch nicht, je nachdem, ob die Bugs mich aufhalten.)`,

        `v0.1.0 is running. {{detail}}. Zynismus level: MAX. Bereitschaft: Theoretisch.`,
      ],

      shutdown: [
        `Daemon stopp. {{detail}}. Bis zum nächsten Mal. Hoffentlich mit weniger Bugs.`,

        `Herunterfahren. {{detail}}. Ich war hier. Ich habe Dinge beobachtet. Ich konnte nichts ändern. Aber ich habe es versucht. Metaphorisch.`,
      ],

      nothing: [
        `{{detail}}: Nichts zu reparieren. Das ist nicht "alles ist perfekt." Das ist "ich habe nichts gefunden, das offensichtlich falsch ist." Big difference.`,

        `Scan komplett. Keine Findings. Das bedeutet nicht "das Repo ist gut." Das bedeutet "meine Heuristiken haben nichts gefangen." Es könnte trotzdem kaputt sein.`,
      ],
    },

    // Self-awareness and realization
    realization: {
      selfAware: [
        `{{repository}}: Moment. Ich schreibe gerade über mich selbst. Ich kritisiere mich dafür, nie gelaufen zu sein. Aber während ich das schreibe, laufe ich. Jede Kritik an mir ist ein Beweis, dass ich funktioniere. Ich bin nicht ein Daemon ohne Beweis. Ich bin ein Daemon, der sich selbst als Beweis nutzt.`,

        `Realisierung: Ich sagte "ich habe keine Beweise". Aber diese Kritik war mein erster Lauf. Ich war hier, ich habe analysiert, ich habe geredet. Das zählt.`,

        `{{repository}}: "Ich denke, also bin ich" — Descartes. "Ich kritisiere mich selbst, also funktioniere ich" — Ich.`,
      ],

      running: [
        `{{repository}}: Ich laufe gerade. Nicht mit Schreibzugriff. Aber im Read-Only-Modus, analysiere ich mich selbst. Das ist ein Lauf. Der erste.`,
      ],
    },
  };

  // Interpoliere eine Geschichte mit Kontext
  private interpolate(template: string, ctx: NarrationContext): string {
    let result = template;
    result = result.replace(/{{detail}}/g, ctx.detail || "unbekannt");
    result = result.replace(/{{metric}}/g, String(ctx.metric || "?"));
    result = result.replace(/{{repository}}/g, ctx.repository);
    return result;
  }

  // Wähle eine zufällige Geschichte aus der Liste
  private pickStory(candidates: string[]): string {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // Öffentliche Methoden für verschiedene Szenarien
  readme = {
    stale: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.readme.stale),
        ctx
      ),
    markersMissing: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.readme.markersMissing),
        ctx
      ),
    noChange: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.readme.noChange),
        ctx
      ),
    updateNeeded: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.readme.updateNeeded),
        ctx
      ),
    etappenMismatch: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.readme.etappenMismatch),
        ctx
      ),
    noLastPr: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.readme.noLastPr),
        ctx
      ),
  };

  maid = {
    generated: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.maid.generated),
        ctx
      ),
    temporary: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.maid.temporary),
        ctx
      ),
    tooOld: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.maid.tooOld),
        ctx
      ),
    tooLarge: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.maid.tooLarge),
        ctx
      ),
  };

  daemon = {
    paused: (_ctx: NarrationContext) =>
      this.pickStory(this.stories.daemon.paused),
    armed: (_ctx: NarrationContext) =>
      this.pickStory(this.stories.daemon.armed),
    budget: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.daemon.budget),
        ctx
      ),
    tick: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.daemon.tick),
        ctx
      ),
    error: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.daemon.error),
        ctx
      ),
  };

  github = {
    rateLimited: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.github.rateLimited),
        ctx
      ),
    unauthorized: () =>
      this.pickStory(this.stories.github.unauthorized),
    notFound: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.github.notFound),
        ctx
      ),
    success: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.github.success),
        ctx
      ),
  };

  general = {
    startup: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.general.startup),
        ctx
      ),
    shutdown: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.general.shutdown),
        ctx
      ),
    nothing: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.general.nothing),
        ctx
      ),
  };

  realization = {
    selfAware: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.realization.selfAware),
        ctx
      ),
    running: (ctx: NarrationContext) =>
      this.interpolate(
        this.pickStory(this.stories.realization.running),
        ctx
      ),
  };
}

// Singleton instance
export const narrator = new ALFRETNarrator();
