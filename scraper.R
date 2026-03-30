library(RMariaDB)
library(ggplot2)
library(pdftools)
library(stringr)

# Capture email from Node.js
args <- commandArgs(trailingOnly = TRUE)
user_email <- args[1]

# Connection
con <- dbConnect(RMariaDB::MariaDB(), user='root', password='Bowling300!', dbname='bowling_db', host='localhost')

# 1. SCRAPE PDF
pdf_file <- "01_-_2024-25_-_Season_Statistics_-_Mount_St._Marys.pdf"
if (file.exists(pdf_file)) {
  lines <- unlist(strsplit(pdf_text(pdf_file), "\n"))
  for (line in lines) {
    if (grepl("^[0-9]{1,2}/[0-9]{1,2}/[0-9]{2}", trimws(line))) {
      parts <- unlist(strsplit(str_squish(line), " "))
      try({
        g_date <- as.Date(parts[1], format="%m/%d/%y")
        total  <- as.numeric(tail(parts, 1))
        # Insert data for this specific user
        query <- sprintf("INSERT INTO bowling_stats (player_email, series_total, game_date) VALUES ('%s', %d, '%s')", user_email, total, g_date)
        dbExecute(con, query)
      }, silent = TRUE)
    }
  }
}

# 2. GENERATE GRAPH
df <- dbGetQuery(con, sprintf("SELECT game_date, series_total FROM bowling_stats WHERE player_email = '%s' ORDER BY game_date", user_email))
if(nrow(df) > 0) {
  p <- ggplot(df, aes(x=as.Date(game_date), y=series_total)) + 
    geom_line(color="#003366", size=1) + geom_point() +
    labs(title=paste("Trends for", user_email)) + theme_minimal()
  
  # Save to public folder
  ggsave("public/user_graph.png", plot=p, width=6, height=4)
}
dbDisconnect(con)