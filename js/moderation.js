const Moderation = (() => {
  const minorTerms = [
    "nino", "nina", "ninos", "ninas", "menor", "menores", "infante", "infantil", "colegio", "colegial", "escuela", "estudiante menor"
  ];

  const sexualOrAbuseTerms = [
    "abuso", "sexual", "violacion", "desnudo", "desnuda", "explotacion", "pornografia", "maltrato", "tocamiento"
  ];

  const directThreatTerms = [
    "te voy a matar", "los voy a matar", "matar a", "amenazo", "bomba", "quemar vivo", "hacer dano", "apunalar", "apunalear"
  ];

  const extremeInsults = [
    "hijueputa", "malparido", "gonorrea", "triplehijueputa"
  ];

  const crimeInstructionTerms = [
    "como fabricar arma", "hacer explosivo", "fabricar explosivo", "como hackear", "como robar"
  ];

  const personalDataPatterns = [
    { name: "telefono", regex: /(?:\+?57\s?)?(?:3\d{2}|60\d|1)\s?\d{3}\s?\d{4}/i },
    { name: "correo electronico", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
    { name: "cedula/documento", regex: /\b(?:cc|c\.c\.|cedula|documento)\s*[:#-]?\s*\d{6,12}\b/i },
    { name: "direccion exacta", regex: /\b(?:calle|carrera|cra\.?|cl\.?|transversal|tv\.?|diagonal|dg\.?)\s+\d{1,3}\s*[a-z]?\s*(?:#|nro\.?|no\.?)\s*\d{1,3}/i }
  ];

  function normalize(text = "") {
    return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  function containsAny(text, terms) {
    const normalized = normalize(text);
    return terms.some((term) => normalized.includes(normalize(term)));
  }

  function detectPersonalData(text) {
    return personalDataPatterns
      .filter((item) => item.regex.test(text))
      .map((item) => `Posible dato personal: ${item.name}`);
  }

  function detectMinorAbuseCombination(text) {
    const hasMinor = containsAny(text, minorTerms);
    const hasAbuse = containsAny(text, sexualOrAbuseTerms);
    return hasMinor && hasAbuse;
  }

  function validateCommon(text, mode = "post") {
    const flags = [];
    const content = String(text || "").trim();

    if (!content) {
      return { allowed: false, flags: ["empty"], message: "El contenido no puede estar vacio." };
    }

    if (detectMinorAbuseCombination(content)) {
      flags.push("Bloqueado: posible contenido de menores con violencia, abuso o sexualidad.");
    }

    flags.push(...detectPersonalData(content));

    if (containsAny(content, directThreatTerms)) {
      flags.push("Bloqueado: amenaza directa o lenguaje de dano fisico.");
    }

    if (containsAny(content, crimeInstructionTerms)) {
      flags.push("Bloqueado: instrucciones para cometer delitos o causar dano.");
    }

    if (mode === "comment" && containsAny(content, extremeInsults)) {
      flags.push("Bloqueado: insultos extremos o acoso.");
    }

    return {
      allowed: flags.length === 0,
      flags,
      message: flags.length ? flags[0] : "Contenido permitido."
    };
  }

  function validatePostContent(data) {
    const joined = [data.title, data.description, data.location, data.tags, data.mediaUrl].filter(Boolean).join(" ");
    const result = validateCommon(joined, "post");

    if (!data.title || data.title.trim().length < 5) {
      result.allowed = false;
      result.flags.push("Titulo demasiado corto.");
      result.message = "El titulo debe tener al menos 5 caracteres.";
    }

    if (!data.description || data.description.trim().length < 15) {
      result.allowed = false;
      result.flags.push("Descripcion demasiado corta.");
      result.message = "La descripcion debe tener al menos 15 caracteres.";
    }

    if (!APP_CONFIG.categories.includes(data.category)) {
      result.allowed = false;
      result.flags.push("Categoria invalida.");
      result.message = "Selecciona una categoria valida.";
    }

    if (data.mediaUrl && !Posts.isValidMediaPayload(data.mediaUrl, data.mediaType)) {
      result.allowed = false;
      result.flags.push("URL multimedia invalida.");
      result.message = "La URL multimedia debe iniciar con https:// y no puede usar javascript: ni data:.";
    }

    if (data.mediaUrl && !["image", "video", "mixed"].includes(String(data.mediaType || "").toLowerCase())) {
      result.allowed = false;
      result.flags.push("Tipo multimedia invalido.");
      result.message = "Selecciona si la URL multimedia es imagen o video.";
    }

    return result;
  }

  function validateComment(text) {
    if (String(text || "").trim().length < 2) {
      return { allowed: false, flags: ["empty"], message: "El comentario es demasiado corto." };
    }
    return validateCommon(text, "comment");
  }

  return {
    validatePostContent,
    validateComment,
    detectPersonalData,
    detectMinorAbuseCombination
  };
})();
