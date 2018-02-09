# Itasa

A simple NodeJS script to download subtiles from the best Italian site of subtitles: [http://www.italiansubs.net/](http://www.italiansubs.net/).

### Installation

```
npm -g install itasa-search
```

### Usage

```
itasa Halt and Catch Fire 2x02
```

Use the `--login` flag to change login credentials.

```
itasa Walking Dead 1x06--login
```

Use the `--lucky` flag to download the first one of the list.

```
itasa Breaking Bad 5x13 --lucky
```

Use the `--file` flag to download subtitles according to the filename. You can combile `--file` with `--lucky` to get subtitle with the quality provided in the filename. If the filename point to an existing file subtitle(s) will be also copied  in the directory of the file and renamed as filename.srt

```
itasa --file /mnt/tv shows/bluray-rip/game.of.thrones.s04e06.720p.hdtv.x264.mkv
```
