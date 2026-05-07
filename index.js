
STRUCTURE:

- Clear headings
- Deep analytical paragraphs
- Final judgement or recommendation

REFERENCE:
${REFERENCE}
            `
          },
          {
            role: "user",
            content: combinedInput
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const answer = aiRes.data.choices[0].message.content;

    console.log("GPT answer generated");

    // -------------------- SEND TO TELEGRAM --------------------
    const parts = splitMessage(answer);

    for (const id of USERS) {
      for (const part of parts) {
        await axios.post(
          `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
          {
            chat_id: id,
            text: part
          }
        );
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
